// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUniswapV2Router02.sol";

interface IAethpadTokenV2 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function depositEthReward() external payable;
    function depositEthPlatform() external payable;
    function burnFromCurve(uint256 amount) external;
    function notifyGraduated(address pair, address router) external;
}

/**
 * @title AethpadBondingCurveV2
 * @notice Virtual-reserve bonding curve with ETH-denominated tax split at the
 *         boundary. On buy, a portion of incoming ETH is skimmed to the token
 *         (for holder rewards) and to the factory (for platform fees) BEFORE
 *         the curve AMM math. On sell, the same skim happens on outgoing ETH.
 *
 *         Burn tax is in tokens (1.5% of token flow) to keep deflation on the
 *         supply itself.
 *
 *         Target: 5 ETH net real raised. Virtual ETH: 3 (for price floor).
 *         At graduation, curve adds LP to Uniswap V2 and burns the LP tokens
 *         forever. Pre-graduation, factory owner can force-close and withdraw.
 */
contract AethpadBondingCurveV2 is ReentrancyGuard {
    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant CURVE_TOKEN_SUPPLY = 800_000_000 * 1e18;  // tokens for sale
    uint256 public constant GRAD_TOKEN_SUPPLY = 200_000_000 * 1e18;   // LP reserve
    uint256 public constant TARGET_REAL_ETH = 5 ether;
    uint256 public constant VIRTUAL_ETH = 3 ether;

    // Tax bps (same semantics as token)
    uint256 public constant BURN_BPS = 150;
    uint256 public constant REWARD_BPS = 200;
    uint256 public constant PLATFORM_BPS = 150;

    // Anti-snipe surcharges on sells (bps)
    uint256 public constant SNIPE_BPS_5MIN = 2000;
    uint256 public constant SNIPE_BPS_1HR = 1000;
    uint256 public constant SNIPE_BPS_24HR = 500;

    // ─── Immutables ────────────────────────────────────────────────
    IAethpadTokenV2 public token;
    address public immutable factory;
    address public immutable trustedInitializer;
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Factory public immutable uniswapFactory;

    // ─── State ─────────────────────────────────────────────────────
    uint256 public virtualTokenReserve;
    uint256 public realEthRaised;       // net real ETH raised for curve (after boundary taxes)
    bool public graduated;
    bool public forceClosed;            // set if factory owner withdraws pre-grad

    // Per-user last buy ts (for anti-snipe on sells)
    mapping(address => uint64) public lastBuyAt;

    // ─── Events ────────────────────────────────────────────────────
    event Buy(address indexed buyer, uint256 ethIn, uint256 ethForCurve, uint256 tokensOut, uint256 progressBps);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOutGross, uint256 ethToUser, uint256 progressBps);
    event Graduated(uint256 ethToLp, uint256 tokensToLp, address pair);
    event ForceClosed(address indexed withdrawTo, uint256 ethAmount);

    // ─── Constructor ───────────────────────────────────────────────
    constructor(
        address _factory,
        address _uniswapRouter
    ) {
        factory = _factory;
        trustedInitializer = msg.sender; // Deployer (or Factory if direct)
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        uniswapFactory = IUniswapV2Factory(IUniswapV2Router02(_uniswapRouter).factory());
        virtualTokenReserve = CURVE_TOKEN_SUPPLY;
    }

    function initToken(address _token) external {
        require(address(token) == address(0), "Already init");
        require(msg.sender == trustedInitializer || msg.sender == factory, "Only factory");
        token = IAethpadTokenV2(_token);
    }

    // ═════════════════════════════════════════════════════════════
    //  BUY — ETH in, tokens out
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Buy tokens with ETH. Splits the incoming ETH at the boundary:
     *   - REWARD_BPS → token.depositEthReward()   (holder rewards pool)
     *   - PLATFORM_BPS → token.depositEthPlatform() (fwd to factory owner)
     *   - remainder (including the BURN_BPS portion of value) → curve AMM buy
     * Then burns BURN_BPS of the tokens received (the "burn tax" on supply).
     *
     * Net effect: user sends 1 ETH, curve gets 0.965 ETH worth of tokens,
     * user receives 0.98875 × tokensFromCurveMath tokens (after 1.5% burn),
     * ETH holders/platform get their cuts in ETH.
     */
    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensToUser) {
        require(!graduated && !forceClosed, "Curve closed");
        require(msg.value > 0, "No ETH");

        uint256 ethIn = msg.value;

        // Boundary ETH split
        uint256 rewardEth = (ethIn * REWARD_BPS) / 10_000;
        uint256 platformEth = (ethIn * PLATFORM_BPS) / 10_000;
        uint256 ethForCurve = ethIn - rewardEth - platformEth;
        // Note: burn bps is NOT taken from ETH — it's taken from the token output

        // AMM math using ethForCurve
        uint256 ethReserveBefore = VIRTUAL_ETH + realEthRaised;
        uint256 k = ethReserveBefore * virtualTokenReserve;
        uint256 ethReserveAfter = ethReserveBefore + ethForCurve;
        uint256 tokenReserveAfter = k / ethReserveAfter;
        uint256 tokensOutGross = virtualTokenReserve - tokenReserveAfter;
        require(tokensOutGross > 0, "Too small");

        // Token-side burn tax
        uint256 burnTokens = (tokensOutGross * BURN_BPS) / 10_000;
        tokensToUser = tokensOutGross - burnTokens;
        require(tokensToUser >= minTokensOut, "Slippage");

        // State updates
        virtualTokenReserve = tokenReserveAfter;
        realEthRaised += ethForCurve;

        // Execute boundary ETH payments FIRST so the token contract can
        // credit the reward accumulator before user's balance changes.
        if (rewardEth > 0) {
            token.depositEthReward{value: rewardEth}();
        }
        if (platformEth > 0) {
            token.depositEthPlatform{value: platformEth}();
        }

        // Transfer tokens: burn portion to DEAD, rest to buyer
        if (burnTokens > 0) {
            token.burnFromCurve(burnTokens);
        }
        require(token.transfer(msg.sender, tokensToUser), "Token xfer failed");

        // Stamp last buy time for anti-snipe on this user
        lastBuyAt[msg.sender] = uint64(block.timestamp);

        emit Buy(msg.sender, ethIn, ethForCurve, tokensToUser, _progressBps());

        // Auto-graduate if target reached
        if (realEthRaised >= TARGET_REAL_ETH) {
            _graduate();
        }
    }

    // ═════════════════════════════════════════════════════════════
    //  SELL — tokens in, ETH out (with anti-snipe)
    // ═════════════════════════════════════════════════════════════

    function sell(uint256 tokenAmount, uint256 minEthOut) external nonReentrant returns (uint256 ethToUser) {
        require(!graduated && !forceClosed, "Curve closed");
        require(tokenAmount > 0, "No tokens");

        // Burn portion of input tokens up front
        uint256 burnTokens = (tokenAmount * BURN_BPS) / 10_000;
        uint256 tokensForCurve = tokenAmount - burnTokens;

        // Pull tokens from user into curve (curve holds them)
        // (requires approval)
        require(
            IERC20Like(address(token)).transferFrom(msg.sender, address(this), tokenAmount),
            "Transfer in failed"
        );
        // Forward burn portion via token.burnFromCurve (curve now holds tokens)
        if (burnTokens > 0) {
            token.burnFromCurve(burnTokens);
        }
        // Remaining `tokensForCurve` stay in curve, replenishing the reserve

        // AMM math on tokensForCurve
        uint256 ethReserveBefore = VIRTUAL_ETH + realEthRaised;
        uint256 k = ethReserveBefore * virtualTokenReserve;
        uint256 tokenReserveAfter = virtualTokenReserve + tokensForCurve;
        uint256 ethReserveAfter = k / tokenReserveAfter;
        uint256 ethOutGross = ethReserveBefore - ethReserveAfter;
        require(ethOutGross <= realEthRaised, "Insufficient ETH in curve");
        require(ethOutGross > 0, "Too small");

        virtualTokenReserve = tokenReserveAfter;
        realEthRaised -= ethOutGross;

        // Boundary split on OUTPUT ETH: rewards + platform + anti-snipe extra
        uint256 snipeBps = _antiSnipeBps(msg.sender);
        uint256 rewardEth = (ethOutGross * (REWARD_BPS + snipeBps)) / 10_000;
        uint256 platformEth = (ethOutGross * PLATFORM_BPS) / 10_000;
        ethToUser = ethOutGross - rewardEth - platformEth;
        require(ethToUser >= minEthOut, "Slippage");

        if (rewardEth > 0) {
            token.depositEthReward{value: rewardEth}();
        }
        if (platformEth > 0) {
            token.depositEthPlatform{value: platformEth}();
        }
        (bool ok, ) = payable(msg.sender).call{value: ethToUser}("");
        require(ok, "ETH send failed");

        emit Sell(msg.sender, tokenAmount, ethOutGross, ethToUser, _progressBps());
    }

    // ═════════════════════════════════════════════════════════════
    //  GRADUATION
    // ═════════════════════════════════════════════════════════════

    function _graduate() internal {
        graduated = true;

        uint256 ethForLp = address(this).balance;
        uint256 tokensForLp = GRAD_TOKEN_SUPPLY;
        // Curve also still holds any unsold CURVE_TOKEN_SUPPLY remainder; that
        // remainder becomes part of the LP seed (so the Uniswap price roughly
        // matches the final curve price).
        uint256 curveTokenBal = token.balanceOf(address(this));
        if (curveTokenBal < tokensForLp) {
            tokensForLp = curveTokenBal;
        }

        // Approve router
        require(IERC20Like(address(token)).approve(address(uniswapRouter), tokensForLp), "Approve failed");

        // Create pair if not exists
        address weth = uniswapRouter.WETH();
        address pair = uniswapFactory.getPair(address(token), weth);
        if (pair == address(0)) {
            pair = uniswapFactory.createPair(address(token), weth);
        }

        // Add liquidity, LP goes to DEAD (burned forever).
        // Use 99% minimums to prevent sandwich attacks at graduation
        // while tolerating minor Uniswap rounding.
        uint256 minTokensForLp = (tokensForLp * 99) / 100;
        uint256 minEthForLp    = (ethForLp * 99) / 100;
        uniswapRouter.addLiquidityETH{value: ethForLp}(
            address(token),
            tokensForLp,
            minTokensForLp,
            minEthForLp,
            0x000000000000000000000000000000000000dEaD,
            block.timestamp + 300
        );

        // If any tokens remain in curve (shouldn't, but defensive), burn them
        uint256 leftover = token.balanceOf(address(this));
        if (leftover > 0) {
            token.burnFromCurve(leftover);
        }

        // Notify token contract to enable post-grad tax logic
        token.notifyGraduated(pair, address(uniswapRouter));

        emit Graduated(ethForLp, tokensForLp, pair);
    }

    // ═════════════════════════════════════════════════════════════
    //  EMERGENCY: factory owner force close + withdraw
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Factory owner can pull ETH pre-graduation. Curve closes, no
     *         further trading. All remaining tokens are burned so they cannot
     *         be resold or remain stranded in the curve forever (fix #2).
     */
    function forceCloseAndWithdraw(address to) external nonReentrant {
        require(msg.sender == factory, "Only factory");
        require(!graduated, "Already graduated");
        forceClosed = true;

        // fix #2: burn all remaining tokens before withdrawing ETH
        uint256 tokenBal = token.balanceOf(address(this));
        if (tokenBal > 0) {
            token.burnFromCurve(tokenBal);
        }

        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok, ) = payable(to).call{value: bal}("");
            require(ok, "Withdraw failed");
        }
        emit ForceClosed(to, bal);
    }

    /**
     * @notice Factory stamps lastBuyAt for a user — used when factory performs
     *         the dev buy on behalf of the creator so anti-snipe applies to
     *         creator's actual address, not the factory (fix #1).
     */
    function stampBuyAt(address user) external {
        require(msg.sender == factory, "Only factory");
        lastBuyAt[user] = uint64(block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    function _progressBps() internal view returns (uint256) {
        if (graduated) return 10_000;
        return (realEthRaised * 10_000) / TARGET_REAL_ETH;
    }

    function progressBps() external view returns (uint256) {
        return _progressBps();
    }

    function _antiSnipeBps(address seller) internal view returns (uint256) {
        uint64 last = lastBuyAt[seller];
        if (last == 0) return 0;
        uint256 elapsed = block.timestamp - last;
        if (elapsed < 5 minutes) return SNIPE_BPS_5MIN;
        if (elapsed < 1 hours) return SNIPE_BPS_1HR;
        if (elapsed < 24 hours) return SNIPE_BPS_24HR;
        return 0;
    }

    function getBuyAmount(uint256 ethAmount) external view returns (uint256 tokensToUser) {
        if (graduated || forceClosed) return 0;
        uint256 ethForCurve = (ethAmount * (10_000 - REWARD_BPS - PLATFORM_BPS)) / 10_000;
        uint256 k = (VIRTUAL_ETH + realEthRaised) * virtualTokenReserve;
        uint256 tokenReserveAfter = k / (VIRTUAL_ETH + realEthRaised + ethForCurve);
        uint256 tokensOutGross = virtualTokenReserve - tokenReserveAfter;
        tokensToUser = tokensOutGross - (tokensOutGross * BURN_BPS) / 10_000;
    }

    function getSellAmount(uint256 tokenAmount, address seller) external view returns (uint256 ethToUser) {
        if (graduated || forceClosed) return 0;
        uint256 burnTokens = (tokenAmount * BURN_BPS) / 10_000;
        uint256 tokensForCurve = tokenAmount - burnTokens;
        uint256 k = (VIRTUAL_ETH + realEthRaised) * virtualTokenReserve;
        uint256 ethReserveAfter = k / (virtualTokenReserve + tokensForCurve);
        uint256 ethOutGross = (VIRTUAL_ETH + realEthRaised) - ethReserveAfter;
        if (ethOutGross > realEthRaised) ethOutGross = realEthRaised;
        uint256 snipeBps = _antiSnipeBps(seller);
        uint256 cut = (ethOutGross * (REWARD_BPS + snipeBps + PLATFORM_BPS)) / 10_000;
        ethToUser = ethOutGross > cut ? ethOutGross - cut : 0;
    }

    function currentPrice() external view returns (uint256) {
        uint256 ethReserve = VIRTUAL_ETH + realEthRaised;
        return (ethReserve * 1e18) / virtualTokenReserve;
    }

    receive() external payable {
        // Accept refunds from Uniswap router addLiquidity
    }
}

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}
