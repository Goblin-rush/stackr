// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPoolManager.sol";
import "./StackrTokenV3.sol";
import "./StackrHookV3.sol";

/**
 * @title  StackrFactoryV3
 * @notice Creates new Stackr tokens backed by Uniswap V4 pools.
 *
 *  Flow per token creation
 *  ─────────────────────────
 *  1. Factory deploys a new StackrTokenV3 (mints 1B tokens to factory).
 *  2. Factory registers the pool with the hook (hook → token mapping).
 *  3. Factory transfers all 1B tokens to the hook.
 *  4. Factory calls hook.initPoolAndAddLiquidity() which:
 *       a. Initializes the V4 pool at the virtual floor sqrtPrice.
 *       b. Adds full-range liquidity using all 1B tokens.
 *       c. The pool starts with 0 real ETH (virtual floor only).
 *  5. The first buyer provides the initial ETH, setting the real market price.
 *
 *  LP management
 *  ──────────────
 *  The LP position is held by the hook contract and is NOT burned.
 *  The owner of this factory can call withdrawLP() to remove liquidity.
 *  This is transparent to anyone who reads the hook contract on Basescan.
 *
 *  Virtual floor price
 *  ────────────────────
 *  sqrtPriceX96 is computed off-chain to represent the virtual ETH reserve
 *  (equivalent to 3 ETH for 1B tokens in the current V2 curve).
 *
 *  Pre-computed for Base mainnet (VIRTUAL_ETH=3, SUPPLY=1B, both 18 decimals):
 *    price      = VIRTUAL_ETH / SUPPLY = 3e18 / 1e27 = 3e-9
 *    sqrtPrice  = sqrt(3e-9)           ≈ 5.477e-5
 *    Q96        = 2^96                 = 7.9228e28
 *    sqrtPriceX96 ≈ 4_337_385_640_896_646_285_286_817 (≈ 4.34e24)
 *
 *  @dev Auditors:
 *       - Only owner can call withdrawLP; there is NO lock.
 *       - Platform fees accumulate via receive() and can be withdrawn by owner.
 *       - The hook address must be set once and is immutable thereafter.
 *       - createToken is nonReentrant; the hook callback chain is safe.
 */
contract StackrFactoryV3 is Ownable, ReentrancyGuard {
    using CurrencyLibrary for Currency;

    // ─── Virtual floor price (off-chain pre-computed) ─────────────
    // VIRTUAL_ETH = 3 ETH, TOTAL_SUPPLY = 1B tokens (both 18 decimals)
    // price_per_token_eth = 3e18 / 1e27 = 3e-9 ETH per token
    // sqrtPriceX96 = sqrt(3e-9) * 2^96 ≈ 4,337,385,640,896,646,285,286,817
    //
    // Auditors: verify with:
    //   python3 -c "import math; print(int(math.sqrt(3e18/1e27) * 2**96))"
    uint160 public constant VIRTUAL_SQRT_PRICE_X96 = 4_337_385_640_896_646_285_286_817;

    // Tick spacing for 0.3% LP fee tier (fee = 3000)
    int24  public constant TICK_SPACING = 60;
    uint24 public constant LP_FEE       = 3000; // 0.30%

    // ─── Core contracts ───────────────────────────────────────────
    IPoolManager  public immutable poolManager;
    StackrHookV3  public hook;

    // ─── Token registry ───────────────────────────────────────────
    struct TokenRecord {
        address token;
        address creator;
        uint256 deployedAt;
        string  metadataURI;
        PoolKey poolKey;
    }

    mapping(address => TokenRecord) public records; // token addr → record
    address[] public allTokens;

    // ─── Platform fee accounting ──────────────────────────────────
    uint256 public accumulatedPlatformFees;
    uint256 public totalPlatformFeesWithdrawn;

    // ─── Events ───────────────────────────────────────────────────
    event TokenDeployed(
        address indexed token,
        address indexed creator,
        string  name,
        string  symbol,
        string  metadataURI,
        uint160 sqrtPriceX96
    );
    event MetadataUpdated(address indexed token, string newURI);
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);
    event PlatformFeeReceived(address indexed fromToken, uint256 amount);
    event LPWithdrawn(address indexed token, address indexed to);
    event HookUpdated(address indexed oldHook, address indexed newHook);

    // ─── Constructor ─────────────────────────────────────────────

    constructor(
        IPoolManager _poolManager,
        StackrHookV3 _hook
    ) Ownable(msg.sender) {
        require(address(_poolManager) != address(0), "Bad poolManager");
        require(address(_hook)        != address(0), "Bad hook");
        poolManager = _poolManager;
        hook        = _hook;
    }

    // ═════════════════════════════════════════════════════════════
    //  ADMIN
    // ═════════════════════════════════════════════════════════════

    /// @notice Update the hook to a new address (e.g. after hook re-deployment).
    ///         Only callable by the factory owner.
    function updateHook(address payable newHook) external onlyOwner {
        require(newHook != address(0), "Bad hook");
        emit HookUpdated(address(hook), newHook);
        hook = StackrHookV3(newHook);
    }

    // ═════════════════════════════════════════════════════════════
    //  TOKEN CREATION
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Deploy a new token + V4 pool.
     *
     * @param name        Token name (e.g. "Degen Apes")
     * @param symbol      Token symbol (e.g. "DAPE")
     * @param metadataURI Off-chain metadata pointer (IPFS/Vercel URI)
     * @return tokenAddr  Address of the newly deployed StackrTokenV3
     *
     * @dev  Optional dev buy: send ETH with this call to have the factory perform
     *       an initial ETH→token swap for the creator right after pool creation.
     *       The full msg.value is swapped (3% tax still applies per the hook).
     *       Send 0 ETH for the normal zero-cost launch.
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI
    ) external payable nonReentrant returns (address tokenAddr) {
        // Input validation
        require(bytes(name).length        > 0 && bytes(name).length        <= 64,   "Invalid name");
        require(bytes(symbol).length      > 0 && bytes(symbol).length      <= 16,   "Invalid symbol");
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 2048, "Invalid metadataURI");

        // 1. Deploy the ERC-20 (mints 1B tokens to this factory)
        StackrTokenV3 token = new StackrTokenV3(name, symbol, address(this));
        tokenAddr = address(token);

        // 2. Build the pool key.
        //    currency0 must be the numerically smaller address.
        //    Native ETH = address(0) is always currency0.
        Currency currency0 = CurrencyLibrary.NATIVE;           // ETH
        Currency currency1 = Currency.wrap(tokenAddr);          // token

        // Guard: token address must be > ETH (address(0)) — always true.
        require(
            uint160(Currency.unwrap(currency1)) > uint160(Currency.unwrap(currency0)),
            "Token addr ordering violated"
        );

        PoolKey memory key = PoolKey({
            currency0:   currency0,
            currency1:   currency1,
            fee:         LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks(address(hook))
        });

        // 3. Register pool with hook (hook needs to know which token = which pool)
        hook.registerPool(key, tokenAddr);

        // 4. Tell the token which hook it trusts.
        token.setHook(address(hook));

        // 5. Transfer all 1B tokens to the hook for liquidity seeding.
        uint256 totalSupply = token.totalSupply();
        require(
            token.transfer(address(hook), totalSupply),
            "Token transfer to hook failed"
        );

        // 6. Init pool + add full-range liquidity (via hook → PoolManager unlock).
        hook.initPoolAndAddLiquidity(key, VIRTUAL_SQRT_PRICE_X96, totalSupply);

        // 6b. Optional dev buy: if the creator sent ETH, perform an initial swap
        //     so the creator immediately holds some of their own token.
        if (msg.value > 0) {
            hook.devBuy{value: msg.value}(key, msg.sender);
        }

        // 7. Record
        records[tokenAddr] = TokenRecord({
            token:       tokenAddr,
            creator:     msg.sender,
            deployedAt:  block.timestamp,
            metadataURI: metadataURI,
            poolKey:     key
        });
        allTokens.push(tokenAddr);

        emit TokenDeployed(
            tokenAddr,
            msg.sender,
            name,
            symbol,
            metadataURI,
            VIRTUAL_SQRT_PRICE_X96
        );
    }

    // ═════════════════════════════════════════════════════════════
    //  METADATA
    // ═════════════════════════════════════════════════════════════

    /// @notice Update the off-chain metadata URI for a token.  Creator or owner only.
    function updateMetadata(address tokenAddr, string calldata newURI) external {
        TokenRecord storage rec = records[tokenAddr];
        require(rec.token != address(0), "Unknown token");
        require(msg.sender == rec.creator || msg.sender == owner(), "Not authorised");
        rec.metadataURI = newURI;
        emit MetadataUpdated(tokenAddr, newURI);
    }

    // ═════════════════════════════════════════════════════════════
    //  LP MANAGEMENT (owner only)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Withdraw the seeded LP position for a token and send ETH + tokens to `to`.
     *         Only the factory owner can call this.
     *
     * @dev    Emits LPWithdrawn on this contract and LPWithdrawn on the hook.
     *         Both events are publicly visible on any block explorer.
     *         The hook's lpLiquidity for this pool is set to 0 after withdrawal —
     *         calling again will revert with "No LP to withdraw".
     *
     * @param tokenAddr Address of the Stackr token whose LP is being withdrawn.
     * @param to        Recipient of the returned ETH and tokens.
     */
    function withdrawLP(address tokenAddr, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Bad recipient");
        TokenRecord storage rec = records[tokenAddr];
        require(rec.token != address(0), "Unknown token");

        emit LPWithdrawn(tokenAddr, to);

        // Delegate to hook — hook calls PoolManager unlock internally.
        hook.withdrawLP(rec.poolKey, to);
    }

    /**
     * @notice Trigger tax distribution for a specific token's pool.
     *         Permissionless — anyone can call, but exposed here for convenience.
     */
    function distributeTax(address tokenAddr) external {
        TokenRecord storage rec = records[tokenAddr];
        require(rec.token != address(0), "Unknown token");
        hook.distributeTax(rec.poolKey);
    }

    /**
     * @notice Keeper management for a token.  Owner can set the address that
     *         is allowed to call pushRewards() on the token contract.
     */
    function setKeeper(address tokenAddr, address keeper) external onlyOwner {
        TokenRecord storage rec = records[tokenAddr];
        require(rec.token != address(0), "Unknown token");
        StackrTokenV3(payable(rec.token)).setKeeper(keeper);
    }

    // ═════════════════════════════════════════════════════════════
    //  PLATFORM FEE WITHDRAWAL (owner only)
    // ═════════════════════════════════════════════════════════════

    /// @notice Withdraw accumulated platform fees.
    function withdrawPlatformFees(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Bad recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        totalPlatformFeesWithdrawn += amount;
        if (accumulatedPlatformFees >= amount) {
            accumulatedPlatformFees -= amount;
        } else {
            accumulatedPlatformFees = 0;
        }
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH send failed");
        emit PlatformFeesWithdrawn(to, amount);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    function getRecord(address tokenAddr) external view returns (TokenRecord memory) {
        return records[tokenAddr];
    }

    // ═════════════════════════════════════════════════════════════
    //  RECEIVE ETH  (platform fees forwarded from token contracts)
    // ═════════════════════════════════════════════════════════════

    receive() external payable {
        accumulatedPlatformFees += msg.value;
        emit PlatformFeeReceived(msg.sender, msg.value);
    }
}
