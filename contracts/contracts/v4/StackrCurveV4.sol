// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./StackrTokenV4.sol";
import "./interfaces/IUniswapV2.sol";

/**
 * @title  StackrCurveV4
 * @notice Pump.fun-style bonding curve. One curve per token. Constant-product formula
 *         x*y=k with virtual ETH reserve so initial price = $5K FDV (priced via
 *         Chainlink at deploy). At BOND_THRESHOLD real ETH collected, the curve
 *         auto-graduates: sweeps ETH + LP_RESERVE_TOKENS into a Uniswap V2 LP and
 *         burns the unsold curve tokens.
 *
 *  Token distribution
 *  ──────────────────
 *  - Total supply: 1B tokens minted to factory at deploy
 *  - Factory transfers 1B to this curve at construction
 *  - 800M (CURVE_TOKEN_SUPPLY)   → tradable on bonding curve
 *  - 200M (LP_RESERVE_TOKENS)    → reserved for V2 LP at graduation
 *
 *  Fee model
 *  ─────────
 *  - 1% on every buy and sell (deducted from the ETH side of the trade)
 *  - Accrues to creator (token's launcher), pull-claim via claimCreatorFees()
 *
 *  LP ownership
 *  ────────────
 *  - V2 LP tokens minted at graduation are sent to the FACTORY
 *  - Factory OWNER (platform) can withdraw them via factory.withdrawLP()
 *  - Token creator (launcher) does NOT receive any LP
 *
 *  Cancel flow (pre-bond only)
 *  ───────────────────────────
 *  - Factory owner can call cancelLaunch() at any time before graduation
 *  - After cancel: factory owner sweeps ALL real ETH via factory.withdrawCurveEth()
 *                  AND sweeps LP_RESERVE + unsold curve tokens via
 *                  factory.withdrawCurveTokens().
 *  - Bonders receive NOTHING back — bonded ETH goes to factory owner.
 *    They keep their bought tokens (worthless after cancel since no LP exists).
 */
contract StackrCurveV4 is ReentrancyGuard {
    // ═════════════════════════════════════════════════════════════
    //  IMMUTABLES
    // ═════════════════════════════════════════════════════════════

    address public immutable token;             // StackrTokenV4
    address public immutable creator;           // who launched (gets trade fees)
    address public immutable factory;           // can cancel + receives LP tokens at grad

    /// @notice Virtual ETH reserve set at deploy from Chainlink so initial FDV = $5K
    uint256 public immutable virtualEthReserve;

    /// @notice ETH/USD price (8 decimals) at the moment of launch — informational
    uint256 public immutable launchEthUsd;

    // ═════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ═════════════════════════════════════════════════════════════

    uint256 public constant CURVE_TOKEN_SUPPLY = 800_000_000 ether;  // tradable on curve
    uint256 public constant LP_RESERVE_TOKENS  = 200_000_000 ether;  // graduation LP
    uint256 public constant BOND_THRESHOLD     = 2.75 ether;         // real ETH to graduate
    uint256 public constant FEE_BPS            = 100;                // 1%
    uint256 public constant BPS_DENOM          = 10_000;
    address public constant DEAD               = 0x000000000000000000000000000000000000dEaD;

    // Uniswap V2 (mainnet) — passed in by factory but referenced as constants here
    address public immutable v2Router;
    address public immutable v2Factory;
    address public immutable weth;

    // ═════════════════════════════════════════════════════════════
    //  STATE
    // ═════════════════════════════════════════════════════════════

    uint256 public realEthCollected;     // tracks bonding progress
    uint256 public tokensSold;           // CURVE_TOKEN_SUPPLY - tokensSold = current Y
    uint256 public creatorFeesAccrued;   // pull-claimable by creator
    bool    public graduated;            // true after V2 LP deployed
    bool    public cancelled;            // true if factory owner cancelled pre-bond
    address public v2Pair;               // populated at graduation

    // ═════════════════════════════════════════════════════════════
    //  EVENTS
    // ═════════════════════════════════════════════════════════════

    event Bought(address indexed buyer, uint256 ethIn, uint256 fee, uint256 tokensOut, uint256 totalBonded);
    event Sold(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 totalBonded);
    event Graduated(uint256 ethToLP, uint256 tokensToLP, uint256 tokensBurned, address v2Pair);
    event Cancelled(uint256 realEthAtCancel);
    event CreatorFeesClaimed(address indexed to, uint256 amount);
    event EthSweptAfterCancel(address indexed to, uint256 amount);

    // ═════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════

    constructor(
        address _token,
        address _creator,
        address _factory,
        uint256 _virtualEthReserve,
        uint256 _launchEthUsd,
        address _v2Router,
        address _v2Factory,
        address _weth
    ) {
        require(_token != address(0) && _factory != address(0), "Bad addr");
        require(_virtualEthReserve > 0, "Bad virt reserve");
        token = _token;
        creator = _creator;
        factory = _factory;
        virtualEthReserve = _virtualEthReserve;
        launchEthUsd = _launchEthUsd;
        v2Router = _v2Router;
        v2Factory = _v2Factory;
        weth = _weth;
    }

    // ═════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═════════════════════════════════════════════════════════════

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier active() {
        require(!graduated && !cancelled, "Curve inactive");
        _;
    }

    // ═════════════════════════════════════════════════════════════
    //  BUY / SELL
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Buy tokens from the bonding curve.
     * @param  minTokensOut Slippage protection — revert if curve returns less.
     */
    function buy(uint256 minTokensOut) external payable nonReentrant active {
        require(msg.value > 0, "Zero ETH");

        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 netEth = msg.value - fee;

        // Constant-product math: tokensOut = yBefore - yAfter
        uint256 xBefore = virtualEthReserve + realEthCollected;
        uint256 yBefore = CURVE_TOKEN_SUPPLY - tokensSold;
        uint256 k       = xBefore * yBefore;
        uint256 xAfter  = xBefore + netEth;
        uint256 yAfter  = k / xAfter;
        uint256 tokensOut = yBefore - yAfter;

        require(tokensOut >= minTokensOut, "Slippage");
        require(tokensOut > 0, "Zero out");

        realEthCollected   += netEth;
        tokensSold         += tokensOut;
        creatorFeesAccrued += fee;

        require(IERC20Minimal(token).transfer(msg.sender, tokensOut), "Token xfer fail");

        emit Bought(msg.sender, msg.value, fee, tokensOut, realEthCollected);

        // Auto-graduate when threshold reached
        if (realEthCollected >= BOND_THRESHOLD) {
            _graduate();
        }
    }

    /**
     * @notice Sell tokens back to the bonding curve.
     * @param  tokenAmount  Amount of tokens to sell (must be approved to this contract).
     * @param  minEthOut    Slippage protection — revert if curve returns less ETH.
     */
    function sell(uint256 tokenAmount, uint256 minEthOut) external nonReentrant active {
        require(tokenAmount > 0, "Zero tokens");
        require(tokenAmount <= tokensSold, "Exceeds sold");

        uint256 xBefore = virtualEthReserve + realEthCollected;
        uint256 yBefore = CURVE_TOKEN_SUPPLY - tokensSold;
        uint256 yAfter  = yBefore + tokenAmount;
        uint256 xAfter  = (xBefore * yBefore) / yAfter; // k / yAfter
        uint256 ethOut  = xBefore - xAfter;

        uint256 fee     = (ethOut * FEE_BPS) / BPS_DENOM;
        uint256 netOut  = ethOut - fee;

        require(netOut >= minEthOut, "Slippage");
        require(ethOut <= realEthCollected, "Reserve underflow");

        realEthCollected   -= ethOut;
        tokensSold         -= tokenAmount;
        creatorFeesAccrued += fee;

        // Pull tokens from seller
        require(
            IERC20(token).transferFrom(msg.sender, address(this), tokenAmount),
            "Token pull fail"
        );

        // Send ETH to seller
        (bool ok, ) = msg.sender.call{value: netOut}("");
        require(ok, "ETH send fail");

        emit Sold(msg.sender, tokenAmount, netOut, fee, realEthCollected);
    }

    // ═════════════════════════════════════════════════════════════
    //  GRADUATION
    // ═════════════════════════════════════════════════════════════

    function _graduate() internal {
        graduated = true;

        uint256 ethToLP = realEthCollected;        // all collected ETH
        uint256 tokensToLP = LP_RESERVE_TOKENS;
        uint256 unsold = CURVE_TOKEN_SUPPLY - tokensSold;

        // Burn unsold curve tokens
        if (unsold > 0) {
            require(IERC20Minimal(token).transfer(DEAD, unsold), "Burn fail");
        }

        // Approve V2 router for LP add
        require(IERC20Minimal(token).approve(v2Router, tokensToLP), "Approve fail");

        // Add liquidity — LP tokens go to FACTORY (so factory.owner can later withdrawLP)
        IUniswapV2Router02(v2Router).addLiquidityETH{value: ethToLP}(
            token,
            tokensToLP,
            0,            // amountTokenMin (accept any due to math precision)
            0,            // amountETHMin
            factory,      // LP recipient = factory
            block.timestamp + 600
        );

        // Read pair address from V2 factory
        v2Pair = IUniswapV2Factory(v2Factory).getPair(token, weth);

        emit Graduated(ethToLP, tokensToLP, unsold, v2Pair);
    }

    // ═════════════════════════════════════════════════════════════
    //  CANCEL (factory owner only, via factory)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Cancel the launch. Factory owner can then sweep all real ETH
     *         AND all remaining tokens (LP_RESERVE + unsold). Bonders get nothing.
     */
    function cancelLaunch() external onlyFactory active {
        cancelled = true;
        emit Cancelled(realEthCollected);
    }

    /**
     * @notice After cancel, factory owner sweeps all remaining tokens (LP_RESERVE +
     *         unsold curve tokens) to the recipient. Called by factory.
     */
    function sweepTokensAfterCancel(address to) external onlyFactory returns (uint256 amount) {
        require(cancelled, "Not cancelled");
        amount = IERC20Minimal(token).balanceOf(address(this));
        if (amount > 0) {
            require(IERC20Minimal(token).transfer(to, amount), "Sweep fail");
        }
    }

    /**
     * @notice After cancel, factory owner sweeps all real ETH (the bonded ETH
     *         from buyers) to the recipient. Creator fees remain claimable.
     */
    function sweepEthAfterCancel(address payable to) external onlyFactory nonReentrant returns (uint256 amount) {
        require(cancelled, "Not cancelled");
        // Available = total balance minus what's reserved for creator fees
        uint256 reserved = creatorFeesAccrued;
        uint256 bal = address(this).balance;
        amount = bal > reserved ? bal - reserved : 0;
        // Zero out realEthCollected so curve view reflects swept state
        realEthCollected = 0;
        if (amount > 0) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "ETH sweep fail");
        }
        emit EthSweptAfterCancel(to, amount);
    }

    // ═════════════════════════════════════════════════════════════
    //  CREATOR FEES (pull)
    // ═════════════════════════════════════════════════════════════

    function claimCreatorFees(address payable to) external nonReentrant {
        require(msg.sender == creator, "Only creator");
        require(to != address(0), "Bad to");
        uint256 amt = creatorFeesAccrued;
        require(amt > 0, "No fees");
        creatorFeesAccrued = 0;

        (bool ok, ) = to.call{value: amt}("");
        require(ok, "ETH send fail");

        emit CreatorFeesClaimed(to, amt);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Quote tokens out for a given gross ETH input (frontend helper).
     */
    function quoteBuy(uint256 ethIn) external view returns (uint256 tokensOut, uint256 fee) {
        if (ethIn == 0 || graduated || cancelled) return (0, 0);
        fee = (ethIn * FEE_BPS) / BPS_DENOM;
        uint256 netEth = ethIn - fee;
        uint256 xBefore = virtualEthReserve + realEthCollected;
        uint256 yBefore = CURVE_TOKEN_SUPPLY - tokensSold;
        uint256 k = xBefore * yBefore;
        uint256 xAfter = xBefore + netEth;
        uint256 yAfter = k / xAfter;
        tokensOut = yBefore - yAfter;
    }

    /**
     * @notice Quote net ETH out for a given token sell amount (frontend helper).
     */
    function quoteSell(uint256 tokenAmount) external view returns (uint256 ethOut, uint256 fee) {
        if (tokenAmount == 0 || graduated || cancelled) return (0, 0);
        if (tokenAmount > tokensSold) return (0, 0);
        uint256 xBefore = virtualEthReserve + realEthCollected;
        uint256 yBefore = CURVE_TOKEN_SUPPLY - tokensSold;
        uint256 yAfter = yBefore + tokenAmount;
        uint256 xAfter = (xBefore * yBefore) / yAfter;
        uint256 grossOut = xBefore - xAfter;
        fee = (grossOut * FEE_BPS) / BPS_DENOM;
        ethOut = grossOut - fee;
    }

    /**
     * @notice Snapshot of curve state for UI.
     */
    function getCurveState() external view returns (
        uint256 _realEth,
        uint256 _tokensSold,
        uint256 _currentPriceWeiPerToken,
        uint256 _percentBondedBps,
        bool _graduated,
        bool _cancelled
    ) {
        _realEth = realEthCollected;
        _tokensSold = tokensSold;
        uint256 x = virtualEthReserve + realEthCollected;
        uint256 y = CURVE_TOKEN_SUPPLY - tokensSold;
        // price wei per whole token = (x * 1e18) / y
        _currentPriceWeiPerToken = y > 0 ? (x * 1e18) / y : 0;
        _percentBondedBps = (realEthCollected * BPS_DENOM) / BOND_THRESHOLD;
        _graduated = graduated;
        _cancelled = cancelled;
    }

    receive() external payable {}
}

