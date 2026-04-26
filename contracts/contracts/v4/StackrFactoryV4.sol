// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./StackrTokenV4.sol";
import "./StackrCurveV4.sol";
import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/IUniswapV2.sol";

/**
 * @title  StackrFactoryV4
 * @notice Master launchpad. Anyone can deploy a token + curve via deployToken().
 *         Curve is created with fixed $5K starting FDV (priced via Chainlink at the
 *         deploy moment). Token creators earn 1% trade fees from their curve.
 *         The factory OWNER (platform) controls all LP withdrawals — both pre-bond
 *         (LP_RESERVE + unsold curve tokens) and post-bond (V2 LP tokens).
 *
 *  No launch fee is charged — token creators only pay gas to deploy.
 */
contract StackrFactoryV4 is Ownable, ReentrancyGuard {
    // ═════════════════════════════════════════════════════════════
    //  CONFIG
    // ═════════════════════════════════════════════════════════════

    /// @notice Target starting fully-diluted valuation in USD (18 decimals)
    uint256 public constant LAUNCH_FDV_USD = 5_000 * 1e18;

    /// @notice Curve tokens for sale (must match StackrCurveV4.CURVE_TOKEN_SUPPLY)
    uint256 public constant CURVE_TOKEN_SUPPLY = 800_000_000 ether;
    uint256 public constant TOTAL_SUPPLY        = 1_000_000_000 ether;

    AggregatorV3Interface public immutable ethUsdFeed;
    address public immutable v2Router;
    address public immutable v2Factory;
    address public immutable weth;

    // ═════════════════════════════════════════════════════════════
    //  STATE
    // ═════════════════════════════════════════════════════════════

    struct LaunchRecord {
        address token;
        address curve;
        address creator;
        uint64  deployedAt;
        uint64  launchEthUsd8;   // Chainlink price (8 decimals) at deploy
    }

    mapping(address => LaunchRecord) public records;  // by token address
    address[] public allTokens;

    // ═════════════════════════════════════════════════════════════
    //  EVENTS
    // ═════════════════════════════════════════════════════════════

    event TokenDeployed(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        uint256 ethUsdPrice8,
        uint256 virtualEthReserve
    );
    /// @notice Emitted when a deploy bundles an initial dev-buy in the same tx.
    event DevBuy(
        address indexed token,
        address indexed creator,
        uint256 ethIn,
        uint256 tokensOut
    );
    event LaunchCancelled(address indexed token);
    event LPWithdrawn(address indexed token, address indexed to, uint256 amount);
    event CurveTokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event CurveEthWithdrawn(address indexed token, address indexed to, uint256 amount);

    // ═════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═════════════════════════════════════════════════════════════

    constructor(
        address _ethUsdFeed,
        address _v2Router,
        address _v2Factory,
        address _weth,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_ethUsdFeed != address(0), "Bad feed");
        require(_v2Router != address(0) && _v2Factory != address(0) && _weth != address(0), "Bad v2");
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        v2Router = _v2Router;
        v2Factory = _v2Factory;
        weth = _weth;
    }

    // ═════════════════════════════════════════════════════════════
    //  DEPLOY
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Deploy a new token + bonding curve. No launch fee — only gas.
     * @return token  address of deployed StackrTokenV4
     * @return curve  address of deployed StackrCurveV4
     */
    function deployToken(
        string memory name,
        string memory symbol,
        string memory metadataURI
    ) external nonReentrant returns (address token, address curve) {
        (token, curve) = _deployTokenInternal(name, symbol, metadataURI);
    }

    /**
     * @notice Deploy + immediately buy from the new curve in a single tx.
     * @dev    Sends `msg.value` to the freshly-deployed curve via `buy()`.
     *         The factory becomes the buyer (msg.sender of `buy`), receives the
     *         curve tokens, then forwards them to the original deployer.
     *         A 1% fee is taken by the curve and accrues to the creator (msg.sender),
     *         claimable later via `curve.claimCreatorFees()`.
     *
     *         Pass `msg.value == 0` to behave exactly like `deployToken` (no buy).
     *
     * @param  minTokensOut  Slippage protection for the dev-buy. Pass 0 to accept any.
     * @return token  address of deployed StackrTokenV4
     * @return curve  address of deployed StackrCurveV4
     * @return tokensBought  amount of tokens forwarded to the deployer (0 if no buy)
     */
    function deployTokenWithBuy(
        string memory name,
        string memory symbol,
        string memory metadataURI,
        uint256 minTokensOut
    )
        external
        payable
        nonReentrant
        returns (address token, address curve, uint256 tokensBought)
    {
        (token, curve) = _deployTokenInternal(name, symbol, metadataURI);

        if (msg.value > 0) {
            // Buy from the new curve. Tokens land on this factory.
            uint256 balBefore = IERC20Minimal(token).balanceOf(address(this));
            StackrCurveV4(payable(curve)).buy{value: msg.value}(minTokensOut);
            uint256 balAfter = IERC20Minimal(token).balanceOf(address(this));
            tokensBought = balAfter - balBefore;
            require(tokensBought > 0, "Dev buy got 0");

            // Forward bought tokens to the deployer.
            require(
                IERC20Minimal(token).transfer(msg.sender, tokensBought),
                "Dev buy fwd fail"
            );

            emit DevBuy(token, msg.sender, msg.value, tokensBought);
        }
    }

    /// @dev Shared deploy logic for `deployToken` and `deployTokenWithBuy`.
    function _deployTokenInternal(
        string memory name,
        string memory symbol,
        string memory metadataURI
    ) internal returns (address token, address curve) {
        // Read ETH/USD from Chainlink
        (, int256 answer, , uint256 updatedAt, ) = ethUsdFeed.latestRoundData();
        require(answer > 0, "Bad oracle");
        require(block.timestamp - updatedAt < 3 hours, "Stale oracle");
        uint256 ethUsd8 = uint256(answer);

        // Compute virtual ETH reserve so initial FDV = $5K
        // FDV_eth   = LAUNCH_FDV_USD * 1e8 / ethUsd8 / 1e18  (whole ETH)
        // virtualX  = FDV_eth_wei * (CURVE / TOTAL)
        //           = (LAUNCH_FDV_USD * 1e8 / ethUsd8) * (CURVE_TOKEN_SUPPLY / TOTAL_SUPPLY)
        uint256 fdvEthWei = (LAUNCH_FDV_USD * 1e8) / ethUsd8;
        uint256 virtualEthReserve = (fdvEthWei * CURVE_TOKEN_SUPPLY) / TOTAL_SUPPLY;

        // Deploy token (mints 1B to factory)
        StackrTokenV4 t = new StackrTokenV4(name, symbol, metadataURI, address(this));
        token = address(t);

        // Deploy curve
        StackrCurveV4 c = new StackrCurveV4(
            token,
            msg.sender,
            address(this),
            virtualEthReserve,
            ethUsd8,
            v2Router,
            v2Factory,
            weth
        );
        curve = address(c);

        // Transfer 1B tokens from factory to curve
        require(IERC20Minimal(token).transfer(curve, TOTAL_SUPPLY), "Curve seed fail");

        // Record
        records[token] = LaunchRecord({
            token: token,
            curve: curve,
            creator: msg.sender,
            deployedAt: uint64(block.timestamp),
            launchEthUsd8: uint64(ethUsd8)
        });
        allTokens.push(token);

        emit TokenDeployed(token, curve, msg.sender, name, symbol, metadataURI, ethUsd8, virtualEthReserve);
    }

    // ═════════════════════════════════════════════════════════════
    //  OWNER ACTIONS (LP & cancel)
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Cancel a launch (pre-bond only). Bonders can then refund themselves
     *         via curve.claimRefund(); after that the owner sweeps remaining tokens
     *         via withdrawCurveTokens().
     */
    function cancelLaunch(address tokenAddr) external onlyOwner {
        LaunchRecord storage rec = records[tokenAddr];
        require(rec.curve != address(0), "Unknown token");
        StackrCurveV4(payable(rec.curve)).cancelLaunch();
        emit LaunchCancelled(tokenAddr);
    }

    /**
     * @notice After cancel, sweep LP_RESERVE + unsold curve tokens to recipient.
     */
    function withdrawCurveTokens(address tokenAddr, address to) external onlyOwner nonReentrant {
        require(to != address(0), "Bad to");
        LaunchRecord storage rec = records[tokenAddr];
        require(rec.curve != address(0), "Unknown token");
        uint256 amount = StackrCurveV4(payable(rec.curve)).sweepTokensAfterCancel(to);
        emit CurveTokensWithdrawn(tokenAddr, to, amount);
    }

    /**
     * @notice After cancel, sweep all real ETH from the curve to recipient.
     *         Bonders receive nothing — owner takes all bonded ETH.
     */
    function withdrawCurveEth(address tokenAddr, address payable to) external onlyOwner nonReentrant {
        require(to != address(0), "Bad to");
        LaunchRecord storage rec = records[tokenAddr];
        require(rec.curve != address(0), "Unknown token");
        uint256 amount = StackrCurveV4(payable(rec.curve)).sweepEthAfterCancel(to);
        emit CurveEthWithdrawn(tokenAddr, to, amount);
    }

    /**
     * @notice After bonding/graduation, withdraw all V2 LP tokens to recipient.
     */
    function withdrawLP(address tokenAddr, address to) external onlyOwner nonReentrant {
        require(to != address(0), "Bad to");
        LaunchRecord storage rec = records[tokenAddr];
        require(rec.curve != address(0), "Unknown token");
        require(StackrCurveV4(payable(rec.curve)).graduated(), "Not graduated");

        address pair = IUniswapV2Factory(v2Factory).getPair(tokenAddr, weth);
        require(pair != address(0), "No pair");

        uint256 bal = IERC20Minimal(pair).balanceOf(address(this));
        require(bal > 0, "No LP balance");
        require(IERC20Minimal(pair).transfer(to, bal), "LP xfer fail");

        emit LPWithdrawn(tokenAddr, to, bal);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getRecord(address tokenAddr) external view returns (LaunchRecord memory) {
        return records[tokenAddr];
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /// @notice Current ETH/USD from Chainlink (8 decimals).
    function ethUsdPrice() external view returns (uint256) {
        (, int256 answer, , , ) = ethUsdFeed.latestRoundData();
        return answer > 0 ? uint256(answer) : 0;
    }
}
