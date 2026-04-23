// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPoolManager.sol";
import "./StackrTokenV3.sol";

/**
 * @title  StackrHookV3
 * @notice Uniswap V4 hook that applies a 3% swap tax on all Stackr token pools
 *         and routes it to holder rewards and platform fees.
 *
 *  Tax breakdown (total 3% per swap):
 *   • 1.5% → holder rewards pool  (via token.depositEthReward)
 *   • 1.5% → platform fee         (via token.depositEthPlatform → factory owner)
 *
 *  Anti-snipe surcharges (applied on top of 3% for fast sellers):
 *   • < 5  min since last buy: +20%
 *   • < 1  hr  since last buy: +10%
 *   • < 24 hr  since last buy:  +5%
 *  The anti-snipe portion goes entirely to the rewards pool.
 *
 *  LP fee: 0.3% set on each pool (goes to the factory-held LP position).
 *
 *  Tax collection mechanism
 *  ─────────────────────────
 *  • Buys  (ETH→token): beforeSwap takes BASE_TAX_BPS of ETH input via
 *    specifiedDelta.  PoolManager mints ERC-6909 ETH claims to this hook.
 *  • Sells (token→ETH): afterSwap takes (BASE_TAX_BPS + antiSnipeBps) of
 *    ETH output via hookDeltaUnspecified.  Same claim mechanism.
 *  • distributeTax(key) claims accumulated ETH and splits it 50/50
 *    between rewards and platform.  Permissionless — anyone may trigger.
 *
 *  Hook address requirement (CREATE2)
 *  ────────────────────────────────────
 *  This contract uses beforeSwap + afterSwap, both with delta returns.
 *  Required bits in the hook address lower byte:
 *    BEFORE_SWAP_FLAG              (1 << 7) = 0x80
 *    BEFORE_SWAP_RETURNS_DELTA_FLAG(1 << 3) = 0x08
 *    AFTER_SWAP_FLAG               (1 << 6) = 0x40
 *    AFTER_SWAP_RETURNS_DELTA_FLAG (1 << 2) = 0x04
 *  Combined mask: 0xCC (204)
 *  → deploy via CREATE2, mine salt until: uint160(hookAddr) & 0xFF == 0xCC
 *  → call validateHookAddress() after deployment to confirm.
 *
 *  @dev Auditors — key invariants:
 *       [I-1] Only factory can registerPool and initPoolAndAddLiquidity.
 *       [I-2] Only PoolManager can call hook callbacks.
 *       [I-3] distributeTax is permissionless but nonReentrant.
 *       [I-4] accumulatedEthClaims is zeroed before unlock call (CEI pattern).
 *       [I-5] hookData MUST be abi.encoded user address for anti-snipe to work.
 *             If hookData is empty, user = address(0) and no anti-snipe applies.
 *       [I-6] Tax split: PLATFORM_BPS / BASE_TAX_BPS = 50% platform, 50% rewards.
 *       [I-7] Tax rates are immutable constants — cannot be changed after deploy.
 */
contract StackrHookV3 is ReentrancyGuard, IUnlockCallback {
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencyLibrary for Currency;

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant BASE_TAX_BPS   = 300;  // 3.00% per swap
    uint256 public constant REWARDS_BPS    = 150;  // 1.50% of swap → rewards (50% of tax)
    uint256 public constant PLATFORM_BPS   = 150;  // 1.50% of swap → platform (50% of tax)

    // Anti-snipe extra bps on top of BASE_TAX_BPS (applies to sells only)
    uint256 public constant SNIPE_BPS_5MIN = 2000; // +20%
    uint256 public constant SNIPE_BPS_1HR  = 1000; // +10%
    uint256 public constant SNIPE_BPS_24HR =  500; //  +5%

    // Required bits in the hook address (lower byte) for V4 flag validation.
    // Deployer must mine a CREATE2 salt satisfying: uint160(hookAddr) & 0xFF == HOOK_FLAGS_MASK
    uint160 public constant HOOK_FLAGS_MASK = 0xCC;

    // Pre-computed sqrtPrice at the tickSpacing-60 full-range bounds (±887220).
    // Used to compute liquidity for single-sided (token-only) LP seeding.
    //   python3: from uniswap_v3_math import get_sqrt_ratio_at_tick; ...
    //   sqrtPriceAtTick( 887220) = 1457652066949847389969617340386294118487833376468
    //   sqrtPriceAtTick(-887220) = 4306310044
    uint256 private constant SQRT_PRICE_AT_MAX_TICK =
        1457652066949847389969617340386294118487833376468;
    uint256 private constant SQRT_PRICE_AT_MIN_TICK = 4306310044;

    // Maximum tax amount castable to int128 (prevent overflow in delta packing)
    // = 2^127 - 1
    uint256 private constant MAX_INT128 = 170_141_183_460_469_231_731_687_303_715_884_105_727;

    bytes4 public constant BEFORE_SWAP_SELECTOR = IHooks.beforeSwap.selector;
    bytes4 public constant AFTER_SWAP_SELECTOR  = IHooks.afterSwap.selector;

    // ─── Immutables ───────────────────────────────────────────────
    IPoolManager public immutable poolManager;
    address      public immutable deployer; // can call setFactory once

    // ─── Factory (set once after deployment) ──────────────────────
    address public factory;

    // ─── Pool registry ───────────────────────────────────────────
    /// @dev Maps keccak256(PoolKey) → StackrTokenV3 address
    mapping(bytes32 => address) public poolToken;

    /// @dev Accumulated unclaimed ETH tax (ERC-6909 claims in PoolManager) per pool
    mapping(bytes32 => uint256) public accumulatedEthClaims;

    /// @dev Of the total claims, how much is from anti-snipe (routes 100% to rewards)
    mapping(bytes32 => uint256) public accumulatedSnipeClaims;

    // ─── Anti-snipe: last buy timestamp per user per pool ─────────
    mapping(bytes32 => mapping(address => uint64)) public lastBuyAt;

    // ─── LP position tracking ─────────────────────────────────────
    /// @dev Tracks the liquidity units seeded per pool so withdrawLP knows how much to remove.
    mapping(bytes32 => uint128) public lpLiquidity;

    // ─── Events ───────────────────────────────────────────────────
    event FactorySet(address indexed factory);
    event PoolRegistered(bytes32 indexed poolId, address indexed token);
    event TaxCollected(bytes32 indexed poolId, bool isBuy, uint256 ethAmount, uint256 antiSnipeBps);
    event TaxDistributed(bytes32 indexed poolId, uint256 rewardEth, uint256 platformEth);
    event LPWithdrawn(bytes32 indexed poolId, address indexed to, uint256 ethReceived, uint256 tokensReceived);
    event DevBuyExecuted(bytes32 indexed poolId, address indexed recipient, uint256 ethIn, uint256 tokensOut);
    event SellExecuted(bytes32 indexed poolId, address indexed seller, uint256 tokensIn, uint256 ethOut);

    // ─── Unlock callback action discriminator ─────────────────────
    enum Action { COLLECT, ADD_LIQUIDITY, REMOVE_LIQUIDITY, DEV_BUY, SELL }

    struct CollectPayload {
        Action   action;
        bytes32  poolId;
        Currency ethCurrency;
        uint256  amount;      // total ETH to collect
        uint256  snipeAmount; // portion of amount that is anti-snipe (100% → rewards)
        address  tokenContract;
    }

    struct AddLiquidityPayload {
        Action   action;
        PoolKey  key;
        uint160  sqrtPriceX96;
        uint256  tokenAmount;
        address  tokenContract;
    }

    struct RemoveLiquidityPayload {
        Action  action;
        PoolKey key;
        uint128 liquidity;
        address to;
    }

    struct DevBuyPayload {
        Action  action;
        PoolKey key;
        address recipient;  // who receives the purchased tokens
        uint256 ethAmount;  // ETH to spend (gross, incl. 3% tax)
    }

    struct SellPayload {
        Action  action;
        PoolKey key;
        address recipient;   // who receives the ETH output
        uint256 tokenAmount; // exact token input amount
    }

    // ─── Constructor ─────────────────────────────────────────────

    /// @param _poolManager  Uniswap V4 PoolManager address.
    /// @param _deployer     EOA that will call setFactory() after deployment.
    ///                      Passed explicitly so CREATE2 deployments via a relay
    ///                      (where msg.sender != the EOA) still work correctly.
    /// @dev   factory is set separately via setFactory() after the factory contract
    ///        is deployed.  This breaks the circular constructor dependency so that
    ///        the hook can be deployed via CREATE2 without knowing the factory address.
    constructor(IPoolManager _poolManager, address _deployer) {
        require(address(_poolManager) != address(0), "Bad poolManager");
        require(_deployer != address(0),             "Bad deployer");
        poolManager = _poolManager;
        deployer    = _deployer;
        // NOTE: hook address flag bits are NOT validated here.
        // Call validateHookAddress() after deployment to confirm CREATE2 mining.
    }

    // ─── Modifiers ───────────────────────────────────────────────

    modifier onlyPoolManager() {
        require(msg.sender == address(poolManager), "Only poolManager");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    // ═════════════════════════════════════════════════════════════
    //  DEPLOYMENT VALIDATION + ONE-TIME FACTORY WIRING
    // ═════════════════════════════════════════════════════════════

    /// @notice Returns true if this hook's address satisfies the V4 flag bits.
    ///         Call this after deployment to confirm CREATE2 mining was correct.
    function validateHookAddress() external view returns (bool valid) {
        valid = uint160(address(this)) & HOOK_FLAGS_MASK == HOOK_FLAGS_MASK;
    }

    /// @notice Wire the factory address after it has been deployed.
    ///         Can only be called once (when factory == address(0)), by the deployer.
    ///         Must be called before createToken is used on the factory.
    function setFactory(address _factory) external {
        require(msg.sender == deployer,    "Only deployer");
        require(factory == address(0),     "Factory already set");
        require(_factory != address(0),    "Bad factory");
        factory = _factory;
        emit FactorySet(_factory);
    }

    /// @notice Update the factory to a new address.
    ///         Only callable by the deployer — allows rewiring to a redeployed factory
    ///         without deploying a new hook.
    function updateFactory(address _factory) external {
        require(msg.sender == deployer, "Only deployer");
        require(_factory != address(0), "Bad factory");
        factory = _factory;
        emit FactorySet(_factory);
    }

    // ═════════════════════════════════════════════════════════════
    //  FACTORY-ONLY SETUP
    // ═════════════════════════════════════════════════════════════

    /// @notice Register a pool → token mapping.  Called once per token by factory.
    function registerPool(PoolKey calldata key, address token) external onlyFactory {
        bytes32 id = _poolId(key);
        require(poolToken[id] == address(0), "Already registered");
        require(token != address(0),         "Bad token");
        poolToken[id] = token;
        emit PoolRegistered(id, token);
    }

    // ═════════════════════════════════════════════════════════════
    //  FACTORY: OPTIONAL DEV BUY
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Perform an initial ETH → token swap on behalf of the token creator.
     *         Called by the factory when msg.value > 0 during createToken.
     *         The full msg.value is swapped (gross — 3% tax still applies).
     *
     * @param key       Pool key of the newly created pool.
     * @param recipient Address to receive the purchased tokens (usually msg.sender = creator).
     */
    function devBuy(PoolKey calldata key, address recipient) external payable onlyFactory {
        require(msg.value > 0,                    "No ETH sent");
        require(recipient != address(0),          "Bad recipient");
        require(poolToken[_poolId(key)] != address(0), "Pool not registered");

        DevBuyPayload memory payload = DevBuyPayload({
            action:    Action.DEV_BUY,
            key:       key,
            recipient: recipient,
            ethAmount: msg.value
        });
        poolManager.unlock(abi.encode(payload));
    }

    // ═════════════════════════════════════════════════════════════
    //  PUBLIC SWAP: BUY & SELL
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Buy tokens with ETH.  Open to any address.
     *         Send ETH as msg.value — 3% swap tax still applies.
     *         Tokens are delivered to msg.sender.
     *
     * @param key  Pool key of the token to buy.
     */
    function buy(PoolKey calldata key) external payable nonReentrant {
        require(msg.value > 0, "No ETH sent");
        require(poolToken[_poolId(key)] != address(0), "Not registered");

        DevBuyPayload memory payload = DevBuyPayload({
            action:    Action.DEV_BUY,
            key:       key,
            recipient: msg.sender,
            ethAmount: msg.value
        });
        poolManager.unlock(abi.encode(payload));
    }

    /**
     * @notice Sell tokens for ETH.  Open to any address.
     *         Caller must have approved this hook for at least `tokenAmount`.
     *         ETH (after 3% tax) is delivered to msg.sender.
     *         Anti-snipe surcharge applies if selling soon after buying.
     *
     * @param key         Pool key of the token to sell.
     * @param tokenAmount Exact number of tokens to sell (18 decimals).
     */
    function sell(PoolKey calldata key, uint256 tokenAmount) external nonReentrant {
        bytes32 poolId = _poolId(key);
        require(poolToken[poolId] != address(0), "Not registered");
        require(tokenAmount > 0, "No tokens");

        // Pull tokens from seller into this hook before the unlock.
        address tokenContract = poolToken[poolId];
        require(
            IERC20(tokenContract).transferFrom(msg.sender, address(this), tokenAmount),
            "transferFrom failed"
        );

        SellPayload memory payload = SellPayload({
            action:      Action.SELL,
            key:         key,
            recipient:   msg.sender,
            tokenAmount: tokenAmount
        });
        poolManager.unlock(abi.encode(payload));
    }

    // ═════════════════════════════════════════════════════════════
    //  HOOK CALLBACKS — called by PoolManager only
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice beforeSwap — handles BUY (ETH→token, zeroForOne=true).
     *
     *  For exact-input buys (amountSpecified < 0):
     *    • Take BASE_TAX_BPS of ETH input via positive specifiedDelta.
     *    • PoolManager mints ERC-6909 ETH claims to this hook.
     *    • Pool only uses (ethIn - taxEth) → buyer gets tokens for 97% of ETH.
     *
     *  Sells are NOT taxed here — handled in afterSwap.
     *
     *  hookData encoding: abi.encode(address user)
     *    If hookData is empty or < 32 bytes, anti-snipe is skipped for this swap.
     */
    function beforeSwap(
        address /*sender*/,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        bytes32 poolId = _poolId(key);
        address token  = poolToken[poolId];

        if (token == address(0)) {
            // Not a registered Stackr pool — pass through untaxed.
            return (BEFORE_SWAP_SELECTOR, toBeforeSwapDelta(0, 0), 0);
        }

        BeforeSwapDelta swapDelta = toBeforeSwapDelta(0, 0);

        if (params.zeroForOne) {
            // ── BUY: ETH → token ──────────────────────────────────
            // Exact-input buy: amountSpecified < 0 (ETH in).
            // Specified currency = currency0 = native ETH.
            int256 amt = params.amountSpecified;
            if (amt < 0) {
                uint256 ethIn  = uint256(-amt);
                uint256 taxEth = (ethIn * BASE_TAX_BPS) / 10_000;

                if (taxEth > 0) {
                    require(taxEth <= MAX_INT128, "Tax exceeds int128");
                    // Positive specifiedDelta: hook takes taxEth from the ETH input.
                    // PoolManager mints claims; pool receives (ethIn - taxEth).
                    swapDelta = toBeforeSwapDelta(int128(int256(taxEth)), 0);
                    accumulatedEthClaims[poolId] += taxEth;
                    emit TaxCollected(poolId, true, taxEth, 0);
                }
            }

            // Stamp buy time for the user so anti-snipe applies on future sells.
            address user = hookData.length >= 32 ? abi.decode(hookData, (address)) : address(0);
            if (user != address(0)) {
                lastBuyAt[poolId][user] = uint64(block.timestamp);
                StackrTokenV3(payable(token)).stampBuyAt(user);
            }
        }
        // Sells are handled in afterSwap (ETH output is unknown in beforeSwap).

        return (BEFORE_SWAP_SELECTOR, swapDelta, 0);
    }

    /**
     * @notice afterSwap — handles SELL (token→ETH, zeroForOne=false).
     *
     *  BalanceDelta convention (V4, from caller/router perspective):
     *    delta.amount0() > 0  →  caller RECEIVED ETH  (sell)
     *    delta.amount0() < 0  →  caller PAID ETH       (shouldn't happen on sell)
     *
     *  For sells:
     *    • hookDeltaUnspecified > 0: hook takes that many ETH from the seller's output.
     *    • Seller receives (ETH out - taxEth) instead of full amount.
     *    • Anti-snipe extra bps stacked on top of BASE_TAX_BPS.
     *
     *  hookData encoding: abi.encode(address user)
     *    Must carry the real trader address for anti-snipe to work.
     *
     *  @dev Auditors [V4-SIGN]: V4 delivers BalanceDelta to hooks from the
     *       router/caller's perspective.  For a sell, delta.amount0() is the
     *       ETH the caller received (positive).  If this convention changes
     *       in a future V4 release, update the guard and sign accordingly.
     */
    function afterSwap(
        address /*sender*/,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        bytes32 poolId = _poolId(key);
        address token  = poolToken[poolId];

        // Skip: not a registered pool, or it's a buy (taxed in beforeSwap).
        if (token == address(0) || params.zeroForOne) {
            return (AFTER_SWAP_SELECTOR, 0);
        }

        // ── SELL: token → ETH ─────────────────────────────────────
        // From the caller's (router's) perspective: amount0 > 0 = ETH received.
        int128 ethReceived = delta.amount0();
        if (ethReceived <= 0) {
            // No ETH was received — guard against edge cases.
            return (AFTER_SWAP_SELECTOR, 0);
        }
        uint256 ethOut = uint256(uint128(ethReceived));

        address user     = hookData.length >= 32 ? abi.decode(hookData, (address)) : address(0);
        uint256 snipeBps = user != address(0) ? _antiSnipeBps(poolId, user) : 0;
        uint256 totalBps = BASE_TAX_BPS + snipeBps;
        uint256 taxEth   = (ethOut * totalBps) / 10_000;

        if (taxEth > 0) {
            require(taxEth <= MAX_INT128, "Tax exceeds int128");

            // Track anti-snipe portion separately — it routes 100% to rewards (not 50/50).
            if (snipeBps > 0) {
                uint256 snipeEth = (ethOut * snipeBps) / 10_000;
                accumulatedSnipeClaims[poolId] += snipeEth;
            }

            // Positive hookDeltaUnspecified: hook takes taxEth from the seller's ETH output.
            // PoolManager deducts from seller's ETH and credits this hook as ERC-6909 claims.
            accumulatedEthClaims[poolId] += taxEth;
            emit TaxCollected(poolId, false, taxEth, snipeBps);
            return (AFTER_SWAP_SELECTOR, int128(int256(taxEth)));
        }

        return (AFTER_SWAP_SELECTOR, 0);
    }

    // ═════════════════════════════════════════════════════════════
    //  TAX DISTRIBUTION — permissionless, nonReentrant
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Claim accumulated ETH from PoolManager and split 50/50 between
     *         holder rewards and platform fee.
     *         Anyone may call — keeper, factory, or any external actor.
     *
     * @dev CEI: accumulatedEthClaims[poolId] is zeroed BEFORE the unlock call
     *      so a re-entrant call finds 0 and cannot double-claim.
     */
    function distributeTax(PoolKey calldata key) external nonReentrant {
        bytes32 poolId = _poolId(key);
        address token  = poolToken[poolId];
        require(token != address(0), "Unknown pool");

        uint256 amount     = accumulatedEthClaims[poolId];
        require(amount > 0, "Nothing to distribute");

        // CEI: zero both counters before unlock.
        uint256 snipeAmount              = accumulatedSnipeClaims[poolId];
        accumulatedEthClaims[poolId]     = 0;
        accumulatedSnipeClaims[poolId]   = 0;

        CollectPayload memory payload = CollectPayload({
            action:        Action.COLLECT,
            poolId:        poolId,
            ethCurrency:   key.currency0, // ETH = currency0 = address(0)
            amount:        amount,
            snipeAmount:   snipeAmount,
            tokenContract: token
        });
        poolManager.unlock(abi.encode(payload));
    }

    // ═════════════════════════════════════════════════════════════
    //  UNLOCK CALLBACK — called back by PoolManager
    // ═════════════════════════════════════════════════════════════

    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        // Decode the discriminator from the first 32 bytes (Action is uint8, ABI-padded).
        Action action = abi.decode(data, (Action));

        if (action == Action.COLLECT) {
            CollectPayload memory p = abi.decode(data, (CollectPayload));
            _handleCollect(p);
        } else if (action == Action.ADD_LIQUIDITY) {
            AddLiquidityPayload memory p = abi.decode(data, (AddLiquidityPayload));
            _handleAddLiquidity(p);
        } else if (action == Action.REMOVE_LIQUIDITY) {
            RemoveLiquidityPayload memory p = abi.decode(data, (RemoveLiquidityPayload));
            _handleRemoveLiquidity(p);
        } else if (action == Action.DEV_BUY) {
            DevBuyPayload memory p = abi.decode(data, (DevBuyPayload));
            _handleDevBuy(p);
        } else if (action == Action.SELL) {
            SellPayload memory p = abi.decode(data, (SellPayload));
            _handleSell(p);
        }
        // Note: invalid enum values panic in Solidity 0.8.x before reaching here.

        return "";
    }

    // ─── Collect: claim ETH claims and distribute ─────────────────

    function _handleCollect(CollectPayload memory p) internal {
        // Withdraw ETH claims from PoolManager to this contract.
        poolManager.take(p.ethCurrency, address(this), p.amount);

        // Split logic:
        //  • Anti-snipe portion (p.snipeAmount) → 100% to rewards (design requirement)
        //  • Remaining base tax (p.amount - p.snipeAmount) → 50% rewards / 50% platform
        //
        // baseTax      = p.amount - p.snipeAmount
        // platformEth  = baseTax * PLATFORM_BPS / BASE_TAX_BPS   (50% of base)
        // rewardEth    = baseTax - platformEth + p.snipeAmount    (50% of base + 100% of snipe)
        uint256 snipeAmount = p.snipeAmount <= p.amount ? p.snipeAmount : p.amount;
        uint256 baseTax     = p.amount - snipeAmount;
        uint256 platformEth = (baseTax * PLATFORM_BPS) / BASE_TAX_BPS;
        uint256 rewardEth   = (baseTax - platformEth) + snipeAmount;

        StackrTokenV3 tokenContract = StackrTokenV3(payable(p.tokenContract));

        if (rewardEth > 0) {
            tokenContract.depositEthReward{value: rewardEth}();
        }
        if (platformEth > 0) {
            tokenContract.depositEthPlatform{value: platformEth}();
        }

        emit TaxDistributed(p.poolId, rewardEth, platformEth);
    }

    // ─── Add liquidity: init pool and seed full-range LP ──────────

    /**
     * @dev Initializes the V4 pool and adds full-range liquidity with all tokens.
     *
     *  Settlement flow (V4 flash accounting):
     *   1. poolManager.initialize — sets the virtual floor price.
     *   2. poolManager.modifyLiquidity — creates token and ETH debts.
     *   3. For the token debt: transfer tokens to PoolManager + sync.
     *   4. For any ETH debt: should not arise since we start with 0 real ETH.
     *      Guard included defensively.
     *
     *  @dev Auditors [V4-SETTLE]: the settle sequence (sync then settle) must
     *       match V4's expected callback flow.  If modifyLiquidity creates
     *       unexpected ETH debt, the unlock will revert with "currency not settled".
     */
    function _handleAddLiquidity(AddLiquidityPayload memory p) internal {
        // 1. Initialize pool at the virtual floor price. Returns the current tick.
        int24 currentTick = poolManager.initialize(p.key, p.sqrtPriceX96);

        // 2. Single-sided token-only LP: position entirely ABOVE current price.
        //    This way only token1 (the Stackr token) is required — no ETH needed.
        //
        //    tickLower = next tick boundary ABOVE currentTick (rounded up to tickSpacing).
        //    tickUpper = max valid tick for tickSpacing 60.
        //
        //    Auditors [V4-SINGLE-SIDED]: when tickLower > currentTick, Uniswap V4
        //    computes amount0 (ETH) = 0 and amount1 (token) = L*(sqrtUpper-sqrtLower)/Q96.
        //    No ETH settlement is required.
        int24 tickSpacing = p.key.tickSpacing;
        int24 tickLower   = _nextTickAbove(currentTick, tickSpacing);
        int24 tickUpper   = 887220;

        // 3. Compute liquidity from token amount for a single-sided position.
        //    For a position (tickLower, tickUpper) entirely above current price:
        //      amount1 = L * (sqrtUpper - sqrtLower) / Q96
        //    Solving for L:
        //      L = tokenAmount * Q96 / (sqrtUpper - sqrtLower)
        //    We use the pre-computed sqrtPrice at the full-range bounds (±887220) as
        //    constants.  Since sqrtUpper >> sqrtLower the approximation error is <0.01%.
        uint256 Q96 = 2 ** 96;
        uint256 liquidity = (p.tokenAmount * Q96) /
            (SQRT_PRICE_AT_MAX_TICK - SQRT_PRICE_AT_MIN_TICK);
        require(liquidity > 0, "Zero liquidity");

        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower:      tickLower,
            tickUpper:      tickUpper,
            liquidityDelta: int256(liquidity),
            salt:           bytes32(0)
        });

        (BalanceDelta callerDelta, ) = poolManager.modifyLiquidity(p.key, liqParams, "");

        // Store seeded liquidity units so withdrawLP knows how much to remove later.
        bytes32 pid = _poolId(p.key);
        lpLiquidity[pid] = uint128(liquidity);

        // 4. Settle token debt (currency1 = the Stackr token).
        int128 token1Delta = callerDelta.amount1();
        if (token1Delta < 0) {
            uint256 tokenDebt = uint256(uint128(-token1Delta));
            IERC20 tkn = IERC20(Currency.unwrap(p.key.currency1));
            // Transfer tokens to PoolManager then sync to close the debt.
            require(tkn.transfer(address(poolManager), tokenDebt), "Token transfer failed");
            poolManager.sync(p.key.currency1);
        }

        // 5. Settle ETH debt (currency0).
        //    For a pool initialised with 0 real ETH, amount0 should be 0.
        //    Included defensively — if unexpected ETH debt arises, it reverts
        //    here rather than leaving the unlock in an unsettled state.
        int128 eth0Delta = callerDelta.amount0();
        if (eth0Delta < 0) {
            uint256 ethDebt = uint256(uint128(-eth0Delta));
            // ETH must already be in this hook for this to succeed.
            require(address(this).balance >= ethDebt, "Insufficient ETH for LP");
            poolManager.settle{value: ethDebt}();
        }
    }

    // ═════════════════════════════════════════════════════════════
    //  FACTORY: INIT POOL ENTRY POINT
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Initialize a V4 pool and seed full-range liquidity.
     *         The factory must transfer all tokens to this hook BEFORE calling.
     *
     * @param key          Pool key for the new pool.
     * @param sqrtPriceX96 Virtual floor price (pre-computed off-chain).
     * @param tokenAmount  Token amount held by this hook to seed as LP.
     */
    function initPoolAndAddLiquidity(
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        uint256 tokenAmount
    ) external onlyFactory {
        bytes32 poolId = _poolId(key);
        address token  = poolToken[poolId];
        require(token != address(0), "Pool not registered");

        // Verify the hook actually holds the tokens.
        require(
            IERC20(Currency.unwrap(key.currency1)).balanceOf(address(this)) >= tokenAmount,
            "Hook missing tokens"
        );

        AddLiquidityPayload memory payload = AddLiquidityPayload({
            action:        Action.ADD_LIQUIDITY,
            key:           key,
            sqrtPriceX96:  sqrtPriceX96,
            tokenAmount:   tokenAmount,
            tokenContract: token
        });
        poolManager.unlock(abi.encode(payload));
    }

    // ═════════════════════════════════════════════════════════════
    //  FACTORY: WITHDRAW LP
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Remove all seeded liquidity from a pool and send ETH + tokens to `to`.
     *         Only callable by the factory (which gates it to the factory owner).
     *
     * @dev This action is publicly visible on-chain via the LPWithdrawn event.
     *      Anyone monitoring the hook contract or the token address on a block
     *      explorer will see this transaction.
     *
     * @param key  Pool key of the token whose LP is being withdrawn.
     * @param to   Recipient of the ETH and tokens returned from the pool.
     */
    function withdrawLP(PoolKey calldata key, address to) external onlyFactory {
        bytes32 poolId = _poolId(key);
        require(poolToken[poolId] != address(0), "Unknown pool");

        uint128 liq = lpLiquidity[poolId];
        require(liq > 0, "No LP to withdraw");

        // Zero out before unlock (CEI).
        lpLiquidity[poolId] = 0;

        RemoveLiquidityPayload memory payload = RemoveLiquidityPayload({
            action:    Action.REMOVE_LIQUIDITY,
            key:       key,
            liquidity: liq,
            to:        to
        });
        poolManager.unlock(abi.encode(payload));
    }

    // ─── Remove liquidity: take ETH + tokens back from pool ───────

    function _handleRemoveLiquidity(RemoveLiquidityPayload memory p) internal {
        bytes32 poolId = _poolId(p.key);

        // Remove all tracked liquidity from the pool.
        IPoolManager.ModifyLiquidityParams memory liqParams = IPoolManager.ModifyLiquidityParams({
            tickLower:      -887220,
            tickUpper:       887220,
            liquidityDelta: -int256(uint256(p.liquidity)),
            salt:           bytes32(0)
        });

        (BalanceDelta delta, ) = poolManager.modifyLiquidity(p.key, liqParams, "");

        // delta from caller's perspective: positive = owed to us.
        uint256 ethOut    = delta.amount0() > 0 ? uint256(uint128(delta.amount0()))    : 0;
        uint256 tokenOut  = delta.amount1() > 0 ? uint256(uint128(delta.amount1()))    : 0;

        // Take ETH from PoolManager and send to recipient.
        if (ethOut > 0) {
            poolManager.take(p.key.currency0, p.to, ethOut);
        }

        // Take tokens from PoolManager and send to recipient.
        if (tokenOut > 0) {
            poolManager.take(p.key.currency1, p.to, tokenOut);
        }

        emit LPWithdrawn(poolId, p.to, ethOut, tokenOut);
    }

    // ─── Sell: swap token → ETH ───────────────────────────────────

    /**
     * @notice Execute a token→ETH sell inside the PoolManager's unlock callback.
     *
     *  Flow:
     *   1. Swap tokenAmount of tokens (zeroForOne=false, exact-input) via PoolManager.
     *   2. afterSwap fires → hook takes (3% + anti-snipe) tax from ETH output as claims.
     *   3. Settle token debt: transfer tokens to PoolManager + sync.
     *   4. Take net ETH (after tax) for recipient.
     *
     *  V4 BalanceDelta after swap (from locker/hook perspective):
     *   delta.amount0() = +(ethOut − taxEth)   → PoolManager owes net ETH to hook
     *   delta.amount1() = −tokenAmount          → hook owes tokens to PoolManager
     */
    function _handleSell(SellPayload memory p) internal {
        bytes32 poolId = _poolId(p.key);

        // Exact-input token→ETH swap.
        // amountSpecified < 0 = exact input of the specified currency (currency1 = tokens).
        // sqrtPriceLimitX96 = MAX_SQRT_PRICE−1 allows any price movement.
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne:        false,
            amountSpecified:   -int256(p.tokenAmount),
            sqrtPriceLimitX96: uint160(SQRT_PRICE_AT_MAX_TICK - 1)
        });

        // hookData = abi.encode(recipient) so afterSwap can apply anti-snipe.
        bytes memory hookData = abi.encode(p.recipient);

        BalanceDelta swapDelta = poolManager.swap(p.key, swapParams, hookData);

        // amount1 is negative (we owe tokens to pool); settle by transfer + sync.
        int128 tokenDelta = swapDelta.amount1();
        if (tokenDelta < 0) {
            uint256 tokenDebt = uint256(int256(-tokenDelta));
            IERC20 tkn = IERC20(Currency.unwrap(p.key.currency1));
            require(tkn.transfer(address(poolManager), tokenDebt), "Token settle failed");
            poolManager.sync(p.key.currency1);
        }

        // amount0 is positive (pool owes net ETH to hook after tax); take for recipient.
        int128 ethDelta = swapDelta.amount0();
        if (ethDelta > 0) {
            uint256 ethOut = uint256(int256(ethDelta));
            poolManager.take(p.key.currency0, p.recipient, ethOut);
            emit SellExecuted(poolId, p.recipient, p.tokenAmount, ethOut);
        }
    }

    // ─── Dev buy: swap ETH → token for the token creator ─────────

    /**
     * @notice Execute the dev buy swap inside the PoolManager's unlock callback.
     *
     *  Flow:
     *   1. Swap ethAmount of ETH (zeroForOne=true, exact-input) via PoolManager.
     *   2. beforeSwap fires → hook takes 3% tax as ERC-6909 claims.
     *   3. Pool delivers tokensOut based on effective ETH (97% of ethAmount).
     *   4. Settle: pay full ethAmount in ETH, take tokensOut for recipient.
     *
     *  V4 BalanceDelta convention after the swap:
     *   delta.amount0() = -(ethAmount)   → hook owes ETH to PoolManager
     *   delta.amount1() = +(tokensOut)   → PoolManager owes tokens to hook
     */
    function _handleDevBuy(DevBuyPayload memory p) internal {
        bytes32 poolId = _poolId(p.key);

        // Exact-input ETH→token swap.  sqrtPriceLimitX96 = MIN_SQRT_PRICE+1 allows
        // full price movement (no front-run risk in this single-tx context).
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne:        true,
            amountSpecified:   -int256(p.ethAmount),   // negative = exact input
            sqrtPriceLimitX96: uint160(SQRT_PRICE_AT_MIN_TICK + 1)
        });

        // hookData = abi.encode(recipient) so beforeSwap stamps the buy time.
        bytes memory hookData = abi.encode(p.recipient);

        BalanceDelta swapDelta = poolManager.swap(p.key, swapParams, hookData);

        // amount0 is negative (we owe ETH); settle by sending ETH to PoolManager.
        int128 ethDelta = swapDelta.amount0();
        if (ethDelta < 0) {
            uint256 ethOwed = uint256(int256(-ethDelta));
            poolManager.settle{value: ethOwed}();
        }

        // amount1 is positive (PoolManager owes tokens); take them for the recipient.
        int128 tokenDelta = swapDelta.amount1();
        if (tokenDelta > 0) {
            uint256 tokensOut = uint256(int256(tokenDelta));
            poolManager.take(p.key.currency1, p.recipient, tokensOut);
            emit DevBuyExecuted(poolId, p.recipient, p.ethAmount, tokensOut);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═════════════════════════════════════════════════════════════

    function _poolId(PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key));
    }

    function _antiSnipeBps(bytes32 poolId, address user) internal view returns (uint256) {
        uint64 lastBuy = lastBuyAt[poolId][user];
        if (lastBuy == 0) return 0;
        uint256 elapsed = block.timestamp - lastBuy;
        if (elapsed < 5 minutes)  return SNIPE_BPS_5MIN;
        if (elapsed < 1 hours)    return SNIPE_BPS_1HR;
        if (elapsed < 24 hours)   return SNIPE_BPS_24HR;
        return 0;
    }

    /// @dev Returns the smallest tick-spacing-aligned tick that is strictly
    ///      greater than `tick`.  Used to place the LP position entirely above
    ///      the current price so no ETH (currency0) is required.
    ///
    ///      Solidity integer division truncates toward zero, so:
    ///        rem = tick % tickSpacing  (may be negative for negative ticks)
    ///        • rem == 0 → tick is already aligned; next boundary = tick + tickSpacing
    ///        • rem  > 0 → round up: tick - rem + tickSpacing
    ///        • rem  < 0 → tick - rem moves toward +∞ (adds |rem| to tick)
    function _nextTickAbove(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 rem = tick % tickSpacing;
        if (rem == 0) return tick + tickSpacing;
        if (rem  > 0) return tick - rem + tickSpacing;
        return tick - rem; // rem < 0 → equivalent to tick + |rem|
    }

    receive() external payable {}
}
