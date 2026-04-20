// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BondingCurveLaunchpad
 * @notice Pump.fun-style bonding curve token.
 *         - Buy/sell via AMM constant-product curve.
 *         - Target: 3.5 ETH raised = 100% ("graduated").
 *         - After graduation: sells disabled, admin withdraws ETH manually.
 *         - Admin adds LP on Uniswap manually after withdrawal.
 *
 * Supply breakdown (1 billion tokens):
 *   80% (800M) → bonding curve contract holds
 *   20% (200M) → admin/team wallet
 *
 * AMM virtual reserves at launch:
 *   virtualEthReserve  = 1.5 ETH  (sets starting price)
 *   virtualTokenReserve = 800M tokens
 *   k = 1.5 * 800M = 1.2B
 *
 * Price at start  ≈ $0.0000044  per token  (~$4.4k market cap)
 * Price at 100%   ≈ $0.0000485  per token  (~$48k market cap)
 */
contract BondingCurveLaunchpad is ERC20, Ownable, ReentrancyGuard {

    // ─── Constants ────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY    = 1_000_000_000 * 1e18;
    uint256 public constant CURVE_SUPPLY    =   800_000_000 * 1e18; // 80%
    uint256 public constant TEAM_SUPPLY     =   200_000_000 * 1e18; // 20%
    uint256 public constant TARGET_ETH      = 3.5 ether;
    uint256 public constant VIRTUAL_ETH     = 1.5 ether;            // virtual reserve

    // ─── State ────────────────────────────────────────────────────
    uint256 public virtualTokenReserve;   // tracks tokens left in curve
    uint256 public realEthRaised;         // actual ETH raised so far
    bool    public graduated;             // true once 3.5 ETH reached

    // ─── Events ───────────────────────────────────────────────────
    event Buy(address indexed buyer,  uint256 ethIn,     uint256 tokensOut, uint256 progress);
    event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut,   uint256 progress);
    event Graduated(uint256 ethRaised);
    event EthWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────
    constructor(
        string memory _name,
        string memory _symbol,
        address _admin
    ) ERC20(_name, _symbol) Ownable(_admin) {
        virtualTokenReserve = CURVE_SUPPLY;
        _mint(address(this), CURVE_SUPPLY);   // held by contract for curve
        _mint(_admin, TEAM_SUPPLY);           // 20% straight to admin
    }

    // ─── Buy ──────────────────────────────────────────────────────
    /**
     * @notice Buy tokens with ETH. Always open — no cap, no refund.
     *         When 3.5 ETH threshold is first crossed, the curve graduates:
     *         ALL ETH in contract auto-withdraws to admin, and sells are
     *         permanently disabled. Buying remains open forever.
     *         Any ETH from buys after graduation accumulates until admin
     *         calls withdrawEth() again.
     */
    function buy() external payable nonReentrant {
        require(msg.value > 0, "Send ETH to buy");

        uint256 ethIn = msg.value;

        // AMM: k = (virtualEth + realEthRaised) * virtualTokenReserve
        uint256 ethReserveBefore  = VIRTUAL_ETH + realEthRaised;
        uint256 k                 = ethReserveBefore * virtualTokenReserve;
        uint256 ethReserveAfter   = ethReserveBefore + ethIn;
        uint256 tokenReserveAfter = k / ethReserveAfter;
        uint256 tokensOut         = virtualTokenReserve - tokenReserveAfter;

        require(tokensOut > 0, "Too small");

        virtualTokenReserve = tokenReserveAfter;
        realEthRaised      += ethIn;

        _transfer(address(this), msg.sender, tokensOut);

        // First time hitting 100% — graduate + auto-withdraw all ETH to admin
        if (!graduated && realEthRaised >= TARGET_ETH) {
            graduated = true;
            emit Graduated(realEthRaised);
            uint256 raised = address(this).balance;
            (bool sent,) = payable(owner()).call{value: raised}("");
            require(sent, "Auto-withdraw failed");
            emit EthWithdrawn(owner(), raised);
        }

        emit Buy(msg.sender, ethIn, tokensOut, getProgress());
    }

    // ─── Sell ─────────────────────────────────────────────────────
    /**
     * @notice Sell tokens back for ETH.
     *         Disabled after graduation.
     */
    function sell(uint256 tokenAmount) external nonReentrant {
        require(!graduated,    "Cannot sell: token graduated");
        require(tokenAmount > 0, "No tokens specified");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");

        // AMM: reverse direction
        uint256 ethReserveBefore  = VIRTUAL_ETH + realEthRaised;
        uint256 k                 = ethReserveBefore * virtualTokenReserve;
        uint256 tokenReserveAfter = virtualTokenReserve + tokenAmount;
        uint256 ethReserveAfter   = k / tokenReserveAfter;
        uint256 ethOut            = ethReserveBefore - ethReserveAfter;

        require(ethOut <= realEthRaised, "Not enough ETH in pool");
        require(ethOut > 0,              "Too small");

        virtualTokenReserve = tokenReserveAfter;
        realEthRaised      -= ethOut;

        _transfer(msg.sender, address(this), tokenAmount);

        (bool ok,) = payable(msg.sender).call{value: ethOut}("");
        require(ok, "ETH transfer failed");

        emit Sell(msg.sender, tokenAmount, ethOut, getProgress());
    }

    // ─── Admin: withdraw ETH (anytime) ───────────────────────────
    /**
     * @notice Admin withdraws raised ETH to manually add LP on Uniswap.
     *         Callable at ANY time — before or after graduation.
     *         If called before graduation, the curve is forcibly closed
     *         (buys and sells disabled) so no new ETH enters or exits.
     */
    function withdrawEth() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No ETH to withdraw");

        // Force-close the curve if not yet graduated
        if (!graduated) {
            graduated = true;
            emit Graduated(realEthRaised);
        }

        (bool ok,) = payable(owner()).call{value: bal}("");
        require(ok, "Withdraw failed");
        emit EthWithdrawn(owner(), bal);
    }

    // ─── Views ────────────────────────────────────────────────────
    /**
     * @notice Returns progress 0–100 (%).
     */
    function getProgress() public view returns (uint256) {
        if (graduated) return 100;
        return (realEthRaised * 100) / TARGET_ETH;
    }

    /**
     * @notice Returns the current buy price in ETH per 1 full token.
     */
    function currentPrice() external view returns (uint256) {
        uint256 ethReserve   = VIRTUAL_ETH + realEthRaised;
        // price = ethReserve / tokenReserve  (scaled 1e18)
        return (ethReserve * 1e18) / virtualTokenReserve;
    }

    /**
     * @notice Preview: how many tokens you get for `ethAmount`.
     */
    function getBuyAmount(uint256 ethAmount) external view returns (uint256 tokensOut) {
        if (graduated) return 0;
        if (realEthRaised + ethAmount > TARGET_ETH) {
            ethAmount = TARGET_ETH - realEthRaised;
        }
        uint256 k = (VIRTUAL_ETH + realEthRaised) * virtualTokenReserve;
        uint256 tokenReserveAfter = k / (VIRTUAL_ETH + realEthRaised + ethAmount);
        tokensOut = virtualTokenReserve - tokenReserveAfter;
    }

    /**
     * @notice Preview: how much ETH you get for selling `tokenAmount`.
     */
    function getSellAmount(uint256 tokenAmount) external view returns (uint256 ethOut) {
        if (graduated) return 0;
        uint256 k = (VIRTUAL_ETH + realEthRaised) * virtualTokenReserve;
        uint256 ethReserveAfter = k / (virtualTokenReserve + tokenAmount);
        ethOut = (VIRTUAL_ETH + realEthRaised) - ethReserveAfter;
        if (ethOut > realEthRaised) ethOut = realEthRaised;
    }
}
