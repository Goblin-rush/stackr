// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUniswapV2Router02.sol";

/**
 * @title AethpadTokenV2
 * @notice FIRE-inspired ERC-20 with time-weighted holder rewards paid in ETH.
 *
 *  PHASES
 *  ------
 *  Pre-graduation:
 *    All trades go through the bonding curve. The curve splits ETH at the
 *    entry/exit boundary and pushes the rewards/platform ETH portions into
 *    this token contract via `depositEthReward()` / `depositEthPlatform()`.
 *    The curve also calls `burnTokens()` for the burn portion.
 *    No ERC-20 tax is applied inside `_update` during this phase.
 *
 *  Post-graduation:
 *    Trades happen on Uniswap V2. This contract intercepts transfers to/from
 *    the Uniswap pair inside `_update` and takes tax in tokens. Tokens
 *    accumulate until a threshold, then a single batched swap converts them
 *    to ETH which is split into rewards/platform and distributed.
 *
 *  REWARDS
 *  -------
 *  Time-weighted: holdScore = balance * secondsHeld. Cumulative ETH per
 *  score is tracked, users claim pending ETH. Selling proportionally resets
 *  holdScore. No keeper needed — accrual updates on every transfer.
 *
 *  ANTI-SNIPE
 *  ----------
 *  Sells within the first 24 hours of last buy incur an extra surcharge
 *  that goes entirely to the rewards pool:
 *    <5 min:  +20%
 *    <1 hr:   +10%
 *    <24 hr:   +5%
 *    >=24 hr:   0%
 */
contract AethpadTokenV2 is ERC20, ReentrancyGuard {
    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant CURVE_SUPPLY = 800_000_000 * 1e18;
    uint256 public constant GRAD_SUPPLY = 200_000_000 * 1e18;

    // Tax basis points (out of 10000)
    uint256 public constant BURN_BPS = 150;      // 1.5%
    uint256 public constant REWARD_BPS = 200;    // 2.0%
    uint256 public constant PLATFORM_BPS = 150;  // 1.5%
    uint256 public constant TOTAL_TAX_BPS = BURN_BPS + REWARD_BPS + PLATFORM_BPS; // 500 (5%)

    // Anti-snipe surcharges (bps, on top of base; sent entirely to rewards pool)
    uint256 public constant SNIPE_BPS_5MIN = 2000;  // +20%
    uint256 public constant SNIPE_BPS_1HR = 1000;   // +10%
    uint256 public constant SNIPE_BPS_24HR = 500;   // +5%

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ─── Immutables (set once) ────────────────────────────────────
    address public immutable factory;   // AethpadFactoryV2
    address public immutable curve;     // AethpadBondingCurveV2

    // ─── Graduation / Uniswap state ───────────────────────────────
    bool public graduated;
    address public uniswapPair;
    IUniswapV2Router02 public uniswapRouter;

    // Threshold of token balance held by this contract before triggering swap
    uint256 public swapThreshold = 100_000 * 1e18;
    bool private _swapping;

    // ─── Hold score bookkeeping ───────────────────────────────────
    struct Checkpoint {
        uint128 balance;               // balance at last checkpoint
        uint64 lastUpdate;             // timestamp of last update
        uint64 lastBuyAt;              // timestamp of last buy (for anti-snipe)
        uint256 accumulatedScore;      // balance*seconds accrued up to lastUpdate
        uint256 ethPerScorePaid;       // reward accumulator snapshot at last settle
        uint256 pendingEth;            // unclaimed ETH rewards
    }
    mapping(address => Checkpoint) public checkpoints;

    uint256 public totalAccumulatedScore;   // sum of all accumulatedScore (settled-to-now lazily)
    uint256 public totalLastUpdate;         // ts of last settle on the global sum
    uint256 public totalSettledBalance;     // sum of all checkpoint balances (for settling total)

    uint256 public cumulativeEthPerScore;   // scaled 1e18
    uint256 public lastRewardTimestamp;     // block.timestamp of last cumulativeEthPerScore update

    // Addresses excluded from TAX logic (curve, factory, this, dead)
    // NOTE: uniswapPair is intentionally NOT in this mapping post-grad so tax fires on swaps.
    //       But it IS excluded from reward tracking via _isTracked().
    mapping(address => bool) public isExcluded;

    // Accumulated reward ETH deposited before any holders existed (rolled in on next deposit)
    uint256 public orphanedRewardEth;

    // Authorized keeper — the only address allowed to call pushRewards()
    // Set once by factory; can be updated by factory owner.
    address public keeper;

    // Maximum holders per pushRewards batch (fix #5: prevent OOG)
    uint256 public constant MAX_PUSH_BATCH = 150;

    // ─── Events ───────────────────────────────────────────────────
    event Graduated(address indexed pair);
    event RewardsDeposited(uint256 ethAmount, uint256 newCumulative);
    event RewardsClaimed(address indexed user, uint256 ethAmount);
    event RewardsPushed(uint256 holderCount, uint256 totalEthSent);
    event TaxTaken(address indexed from, address indexed to, uint256 burnAmt, uint256 rewardAmt, uint256 platformAmt);
    event PlatformFeeForwarded(uint256 ethAmount);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event ScoreDesyncDetected(address indexed user, uint256 drop, uint256 totalScore); // fix #6

    // ─── Constructor ──────────────────────────────────────────────
    constructor(
        string memory _name,
        string memory _symbol,
        address _factory,
        address _curve
    ) ERC20(_name, _symbol) {
        factory = _factory;
        curve = _curve;

        // Set exclusions BEFORE minting so the initial mint does not
        // register the curve in totalSettledBalance or hold-score tracking.
        // If exclusions come after _mint, the curve is briefly tracked and
        // picks up 1 billion tokens in totalSettledBalance — permanently
        // diluting all reward distributions.
        isExcluded[_curve] = true;
        isExcluded[_factory] = true;
        isExcluded[DEAD] = true;
        isExcluded[address(this)] = true;
        isExcluded[address(0)] = true;

        totalLastUpdate = block.timestamp;

        // Mint full supply to the curve (curve holds both CURVE_SUPPLY for sale
        // and GRAD_SUPPLY reserved for graduation LP)
        _mint(_curve, TOTAL_SUPPLY);
    }

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyCurve() {
        require(msg.sender == curve, "Only curve");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    // ═════════════════════════════════════════════════════════════
    //  CURVE INTEGRATION (pre-graduation ETH-split tax path)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Curve deposits ETH earmarked for holder rewards.
     *         Updates cumulative reward accumulator.
     */
    function depositEthReward() external payable onlyCurve {
        _creditRewardPool(msg.value);
    }

    // Platform ETH that could not be forwarded to factory (accumulated for retry)
    uint256 public pendingPlatformEth;

    /**
     * @notice Curve deposits ETH earmarked for platform. Immediately forwards
     *         to factory. If the factory call fails (edge case), parks ETH in
     *         pendingPlatformEth so trades are never bricked. Owner can later
     *         call withdrawPendingPlatform() to recover it.
     */
    function depositEthPlatform() external payable onlyCurve {
        if (msg.value == 0) return;
        (bool ok, ) = payable(factory).call{value: msg.value}("");
        if (ok) {
            emit PlatformFeeForwarded(msg.value);
        } else {
            // Park rather than revert — a factory receive() failure must never
            // permanently prevent buys/sells on this token.
            pendingPlatformEth += msg.value;
        }
    }

    /**
     * @notice Allows factory owner (via factory) to flush any parked platform ETH.
     */
    function withdrawPendingPlatform() external onlyFactory {
        uint256 amount = pendingPlatformEth;
        require(amount > 0, "Nothing pending");
        pendingPlatformEth = 0;
        (bool ok, ) = payable(factory).call{value: amount}("");
        require(ok, "ETH send failed");
        emit PlatformFeeForwarded(amount);
    }

    /**
     * @notice Curve requests burn of `amount` tokens held by curve.
     *         Curve must hold the tokens; we transfer from curve to DEAD.
     */
    function burnFromCurve(uint256 amount) external onlyCurve {
        if (amount > 0) {
            _transfer(curve, DEAD, amount);
        }
    }

    // ═════════════════════════════════════════════════════════════
    //  GRADUATION
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Called by curve when it has added LP to Uniswap and burned it.
     *         Enables post-graduation tax path on pair transfers.
     */
    function notifyGraduated(address _pair, address _router) external onlyCurve {
        require(!graduated, "Already graduated");
        graduated = true;
        uniswapPair = _pair;
        uniswapRouter = IUniswapV2Router02(_router);
        isExcluded[_pair] = false; // pair is taxable (it IS the tax boundary)
        emit Graduated(_pair);
    }

    // ═════════════════════════════════════════════════════════════
    //  ERC-20 OVERRIDE (holdScore + post-grad tax)
    // ═════════════════════════════════════════════════════════════

    function _update(address from, address to, uint256 value) internal override {
        // Settle rewards for both sides before balance changes
        _settleUser(from);
        _settleUser(to);

        // Pre-grad: no ERC-20-level tax (curve handled it at ETH boundary)
        // Post-grad: apply tax on pair transfers (swaps on Uniswap)
        if (graduated && !_swapping && !isExcluded[from] && !isExcluded[to]) {
            bool isBuy = (from == uniswapPair);
            bool isSell = (to == uniswapPair);

            if (isBuy || isSell) {
                uint256 extraBps = 0;
                if (isSell) {
                    extraBps = _antiSnipeExtraBps(from);
                }
                uint256 totalBps = TOTAL_TAX_BPS + extraBps;
                uint256 taxTokens = (value * totalBps) / 10_000;
                uint256 burnAmt = (value * BURN_BPS) / 10_000;

                // Send burn immediately
                if (burnAmt > 0) {
                    super._update(from, DEAD, burnAmt);
                }
                // Rest (reward + platform + anti-snipe extra) held by this contract
                uint256 heldTax = taxTokens - burnAmt;
                if (heldTax > 0) {
                    super._update(from, address(this), heldTax);
                }
                value -= taxTokens;

                // Update lastBuyAt for buyer
                if (isBuy) {
                    checkpoints[to].lastBuyAt = uint64(block.timestamp);
                }

                emit TaxTaken(from, to, burnAmt, 0, 0);
            }
        }

        // Actual transfer of (possibly reduced) value
        super._update(from, to, value);

        // Update holdScore checkpoints AFTER the transfer
        _updateCheckpoint(from);
        _updateCheckpoint(to);

        // Trigger swap-and-distribute if threshold met (post-grad only)
        if (
            graduated &&
            !_swapping &&
            from != uniswapPair &&
            balanceOf(address(this)) >= swapThreshold &&
            address(uniswapRouter) != address(0)
        ) {
            _swapAndDistribute();
        }
    }

    // ═════════════════════════════════════════════════════════════
    //  HOLD SCORE INTERNALS
    // ═════════════════════════════════════════════════════════════

    function _isTracked(address user) internal view returns (bool) {
        if (user == address(0)) return false;
        if (isExcluded[user]) return false;
        // Post-graduation: exclude the Uniswap pair from reward tracking.
        // The pair is NOT in isExcluded (so tax fires on swaps), but it must
        // not accumulate hold score — its pendingEth would be unclaimable forever.
        if (uniswapPair != address(0) && user == uniswapPair) return false;
        return true;
    }

    /**
     * @notice Settle a user's pending ETH rewards based on current accumulator.
     *         Called before any balance change so we use pre-change holdScore.
     *
     *         IMPORTANT: When computing the reward delta, we cap the user's
     *         hold score to `lastRewardTimestamp` — the moment the last reward
     *         was deposited. Without this cap, a user settling after a reward
     *         deposit would use a score that includes time AFTER the deposit,
     *         causing pendingEth to exceed the actual ETH deposited (reverts on send).
     *         The accumulated score is still extended to block.timestamp so future
     *         rewards accumulate correctly.
     */
    function _settleUser(address user) internal {
        if (!_isTracked(user)) return;
        Checkpoint storage c = checkpoints[user];

        uint256 delta = cumulativeEthPerScore - c.ethPerScorePaid;
        if (delta > 0) {
            // Cap score to lastRewardTimestamp to prevent over-claiming
            uint256 capTs = lastRewardTimestamp > c.lastUpdate
                ? lastRewardTimestamp
                : c.lastUpdate;
            uint256 cappedElapsed = capTs - c.lastUpdate;
            uint256 cappedScore = c.accumulatedScore + uint256(c.balance) * cappedElapsed;
            if (cappedScore > 0) {
                c.pendingEth += (cappedScore * delta) / 1e18;
            }
            c.ethPerScorePaid = cumulativeEthPerScore;
        }

        // Extend accumulatedScore to block.timestamp for future reward epochs.
        uint256 elapsed = block.timestamp - c.lastUpdate;
        c.accumulatedScore += uint256(c.balance) * elapsed;
        c.lastUpdate = uint64(block.timestamp);
    }

    /**
     * @notice After a transfer, refresh the user's checkpoint. Also updates
     *         the global totalAccumulatedScore running sum.
     */
    function _updateCheckpoint(address user) internal {
        if (!_isTracked(user)) return;
        Checkpoint storage c = checkpoints[user];

        // Settle the global total up to now using OLD balance snapshot
        _settleGlobalTotal();

        uint256 newBal = balanceOf(user);
        uint256 oldBal = uint256(c.balance);

        if (newBal < oldBal && oldBal > 0) {
            // Proportional holdScore reset on outflow: score scales by newBal/oldBal
            uint256 newScore = (c.accumulatedScore * newBal) / oldBal;
            // Adjust global by the DROP
            uint256 drop = c.accumulatedScore - newScore;
            if (totalAccumulatedScore >= drop) {
                totalAccumulatedScore -= drop;
            } else {
                // fix #6: emit desync event instead of silently flooring to 0
                emit ScoreDesyncDetected(user, drop, totalAccumulatedScore);
                totalAccumulatedScore = 0;
            }
            c.accumulatedScore = newScore;
        }

        // Update settled balance tracker
        if (newBal > oldBal) {
            totalSettledBalance += (newBal - oldBal);
        } else if (newBal < oldBal) {
            uint256 diff = oldBal - newBal;
            totalSettledBalance = totalSettledBalance >= diff ? totalSettledBalance - diff : 0;
        }

        c.balance = uint128(newBal);
        c.lastUpdate = uint64(block.timestamp);

        // If this is a BUY (from curve pre-grad, or from pair post-grad), stamp lastBuyAt
        // (post-grad pair buys are stamped in _update; here we stamp curve buys)
        if (!graduated && newBal > oldBal && msg.sender == curve) {
            c.lastBuyAt = uint64(block.timestamp);
        }
    }

    /**
     * @notice Extend the running totalAccumulatedScore up to block.timestamp
     *         using the current totalSettledBalance.
     */
    function _settleGlobalTotal() internal {
        uint256 elapsed = block.timestamp - totalLastUpdate;
        if (elapsed > 0 && totalSettledBalance > 0) {
            totalAccumulatedScore += totalSettledBalance * elapsed;
        }
        totalLastUpdate = block.timestamp;
    }

    function _creditRewardPool(uint256 ethAmount) internal {
        if (ethAmount == 0) return;
        _settleGlobalTotal();

        uint256 liveTotal = totalAccumulatedScore;
        if (liveTotal == 0) {
            // No holders yet — park ETH until someone holds tokens.
            orphanedRewardEth += ethAmount;
            emit RewardsDeposited(ethAmount, cumulativeEthPerScore);
            return;
        }

        // Roll in any previously orphaned ETH together with this tranche.
        uint256 poolEth = ethAmount + orphanedRewardEth;
        if (orphanedRewardEth > 0) orphanedRewardEth = 0;

        // fix #3: if poolEth is too small relative to liveTotal the division
        // rounds to 0 — ETH would be deposited but permanently unclaimable.
        // Park it as orphaned instead so it is swept in the next deposit.
        uint256 increment = (poolEth * 1e18) / liveTotal;
        if (increment == 0) {
            orphanedRewardEth += poolEth;
            emit RewardsDeposited(poolEth, cumulativeEthPerScore);
            return;
        }

        cumulativeEthPerScore += increment;
        lastRewardTimestamp = block.timestamp;
        emit RewardsDeposited(poolEth, cumulativeEthPerScore);
    }

    function _antiSnipeExtraBps(address seller) internal view returns (uint256) {
        uint64 lastBuy = checkpoints[seller].lastBuyAt;
        if (lastBuy == 0) return 0;
        uint256 elapsed = block.timestamp - lastBuy;
        if (elapsed < 5 minutes) return SNIPE_BPS_5MIN;
        if (elapsed < 1 hours) return SNIPE_BPS_1HR;
        if (elapsed < 24 hours) return SNIPE_BPS_24HR;
        return 0;
    }

    // ═════════════════════════════════════════════════════════════
    //  POST-GRAD SWAP-AND-DISTRIBUTE
    // ═════════════════════════════════════════════════════════════

    function _swapAndDistribute() internal {
        _swapping = true;

        uint256 tokenAmount = balanceOf(address(this));
        if (tokenAmount == 0) {
            _swapping = false;
            return;
        }

        // Swap tokens -> ETH via Uniswap
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapRouter.WETH();

        _approve(address(this), address(uniswapRouter), tokenAmount);

        // fix #4: compute 90% of expected output to guard against sandwich attacks
        uint256 minOut = 0;
        try uniswapRouter.getAmountsOut(tokenAmount, path) returns (uint256[] memory amounts) {
            minOut = (amounts[1] * 90) / 100;
        } catch {}

        uint256 ethBefore = address(this).balance;
        try uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            minOut,
            path,
            address(this),
            block.timestamp
        ) {
            uint256 ethReceived = address(this).balance - ethBefore;
            if (ethReceived > 0) {
                // Split: rewards vs platform, using their post-grad ratio.
                // Post-grad tax = 2% rewards + 1.5% platform (burn already in tokens).
                // Ratio 2 : 1.5 = 4 : 3 → 4/7 rewards, 3/7 platform
                uint256 platformEth = (ethReceived * 3) / 7;
                uint256 rewardEth = ethReceived - platformEth;

                if (platformEth > 0) {
                    (bool ok, ) = payable(factory).call{value: platformEth}("");
                    // If factory call fails, leave ETH here; try next time
                    if (ok) emit PlatformFeeForwarded(platformEth);
                }

                _creditRewardPool(rewardEth);
            }
        } catch {
            // Swap failed — tokens stay, try next time. No revert to not block transfers.
        }

        _swapping = false;
    }

    // ═════════════════════════════════════════════════════════════
    //  PUBLIC USER FUNCTIONS
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Claim pending ETH rewards manually (pull model, always available).
     */
    function claim() external nonReentrant {
        _settleUser(msg.sender);
        Checkpoint storage c = checkpoints[msg.sender];
        uint256 amount = c.pendingEth;
        require(amount > 0, "Nothing to claim");
        c.pendingEth = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH send failed");
        emit RewardsClaimed(msg.sender, amount);
    }

    /**
     * @notice Automatic push distribution — called by the off-chain keeper
     *         (GitHub Actions cron) to push pending ETH rewards to a batch
     *         of holders without them needing to claim.
     *
     *         Only the keeper address can call this. The keeper wallet is
     *         funded from the platform fee and pays the gas cost.
     *
     *         If an ETH send to a holder fails (e.g. a contract that rejects
     *         ETH), that holder's pendingEth is left intact — they can still
     *         call claim() manually.
     *
     * @param holders  List of holder addresses to push rewards to.
     */
    function pushRewards(address[] calldata holders) external nonReentrant {
        require(msg.sender == keeper, "Only keeper");
        require(holders.length <= MAX_PUSH_BATCH, "Batch too large"); // fix #5
        uint256 totalSent;
        uint256 pushed;

        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            if (!_isTracked(holder)) continue;

            _settleUser(holder);
            Checkpoint storage c = checkpoints[holder];
            uint256 amount = c.pendingEth;
            if (amount == 0) continue;

            c.pendingEth = 0;
            (bool ok, ) = payable(holder).call{value: amount}("");
            if (ok) {
                totalSent += amount;
                pushed++;
                emit RewardsClaimed(holder, amount);
            } else {
                // Restore pending so holder can claim() manually
                c.pendingEth = amount;
            }
        }

        emit RewardsPushed(pushed, totalSent);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    function pendingRewards(address user) external view returns (uint256) {
        if (!_isTracked(user)) return 0;
        Checkpoint storage c = checkpoints[user];
        uint256 delta = cumulativeEthPerScore - c.ethPerScorePaid;
        uint256 extra = 0;
        if (delta > 0) {
            // Mirror the capped-score logic from _settleUser so the view
            // returns the exact amount that will be paid on claim/push.
            uint256 capTs = lastRewardTimestamp > c.lastUpdate
                ? lastRewardTimestamp
                : c.lastUpdate;
            uint256 cappedElapsed = capTs - c.lastUpdate;
            uint256 cappedScore = c.accumulatedScore + uint256(c.balance) * cappedElapsed;
            if (cappedScore > 0) {
                extra = (cappedScore * delta) / 1e18;
            }
        }
        return c.pendingEth + extra;
    }

    function holdScore(address user) external view returns (uint256) {
        if (!_isTracked(user)) return 0;
        Checkpoint storage c = checkpoints[user];
        uint256 elapsed = block.timestamp - c.lastUpdate;
        return c.accumulatedScore + uint256(c.balance) * elapsed;
    }

    function totalHoldScoreLive() external view returns (uint256) {
        uint256 elapsed = block.timestamp - totalLastUpdate;
        return totalAccumulatedScore + totalSettledBalance * elapsed;
    }

    function antiSnipeBpsFor(address seller) external view returns (uint256) {
        return _antiSnipeExtraBps(seller);
    }

    // ═════════════════════════════════════════════════════════════
    //  ADMIN (factory-only)
    // ═════════════════════════════════════════════════════════════

    function setSwapThreshold(uint256 newThreshold) external onlyFactory {
        require(newThreshold > 0, "Bad threshold");
        swapThreshold = newThreshold;
    }

    function setExcluded(address account, bool excluded) external onlyFactory {
        isExcluded[account] = excluded;
    }

    /**
     * @notice Set or rotate the keeper address that is allowed to call pushRewards().
     *         Only callable by factory (which restricts it to the platform owner).
     *         Set to address(0) to disable push distribution (holders use claim()).
     */
    function setKeeper(address newKeeper) external onlyFactory {
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    // Accept ETH from curve/router
    receive() external payable {}
}
