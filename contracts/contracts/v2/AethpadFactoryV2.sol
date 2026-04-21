// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AethpadTokenV2.sol";
import "./AethpadBondingCurveV2.sol";
import "./AethpadDeployer.sol";

/**
 * @title AethpadFactoryV2
 * @notice Deploys AethpadTokenV2 + AethpadBondingCurveV2 atomically.
 *         Receives platform-fee ETH from all deployed tokens/curves.
 *         Owner can withdraw accumulated platform fees anytime.
 *         Owner can force-close any curve pre-graduation.
 */
contract AethpadFactoryV2 is Ownable, ReentrancyGuard {
    address public immutable uniswapRouter;
    AethpadDeployer public deployer;

    struct TokenRecord {
        address token;
        address curve;
        address creator;
        uint256 deployedAt;
        string metadataURI;           // off-chain pointer (logo, socials, description)
        uint256 initialDevBuyEth;
        uint256 initialDevBuyTokens;
    }

    mapping(address => TokenRecord) public records;  // token => record
    address[] public allTokens;

    uint256 public accumulatedPlatformFees;          // ETH accrued from all tokens
    uint256 public totalPlatformFeesWithdrawn;

    event TokenDeployed(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string name,
        string symbol,
        string metadataURI,
        uint256 devBuyEth,
        uint256 devBuyTokens
    );
    event PlatformFeeReceived(address indexed fromToken, uint256 amount);
    event PlatformFeesWithdrawn(address indexed to, uint256 amount);
    event MetadataUpdated(address indexed token, string newURI);

    constructor(address _uniswapRouter) Ownable(msg.sender) {
        require(_uniswapRouter != address(0), "Bad router");
        uniswapRouter = _uniswapRouter;
    }

    function setDeployer(address _deployer) external onlyOwner {
        require(address(deployer) == address(0), "Already set");
        deployer = AethpadDeployer(_deployer);
    }

    // ═════════════════════════════════════════════════════════════
    //  TOKEN DEPLOYMENT
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Deploy a new token + curve. Free. Optionally include ETH for
     *         an atomic initial dev buy.
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI
    ) external payable nonReentrant returns (address tokenAddr, address curveAddr) {
        require(address(deployer) != address(0), "Deployer not set");
        (tokenAddr, curveAddr) = deployer.deployPair(name, symbol);
        AethpadTokenV2 token = AethpadTokenV2(payable(tokenAddr));
        AethpadBondingCurveV2 curve = AethpadBondingCurveV2(payable(curveAddr));

        // Record
        records[tokenAddr] = TokenRecord({
            token: tokenAddr,
            curve: curveAddr,
            creator: msg.sender,
            deployedAt: block.timestamp,
            metadataURI: metadataURI,
            initialDevBuyEth: 0,
            initialDevBuyTokens: 0
        });
        allTokens.push(tokenAddr);

        uint256 devBuyEth = msg.value;
        uint256 devBuyTokens = 0;

        // Optional initial dev buy (atomic)
        if (devBuyEth > 0) {
            devBuyTokens = curve.buy{value: devBuyEth}(0);
            // Note: `curve.buy` sends tokens to `msg.sender` of the call,
            // which in this context is this factory. Forward them to creator.
            // Actually — curve.buy uses msg.sender inside curve = this factory.
            // So tokens end up at factory. Forward to creator.
            uint256 received = token.balanceOf(address(this));
            if (received > 0) {
                token.transfer(msg.sender, received);
                devBuyTokens = received;
            }
            records[tokenAddr].initialDevBuyEth = devBuyEth;
            records[tokenAddr].initialDevBuyTokens = devBuyTokens;
        }

        emit TokenDeployed(tokenAddr, curveAddr, msg.sender, name, symbol, metadataURI, devBuyEth, devBuyTokens);
    }

    // ═════════════════════════════════════════════════════════════
    //  METADATA UPDATE (creator-only)
    // ═════════════════════════════════════════════════════════════

    function updateMetadataURI(address tokenAddr, string calldata newURI) external {
        TokenRecord storage r = records[tokenAddr];
        require(r.creator == msg.sender, "Only creator");
        r.metadataURI = newURI;
        emit MetadataUpdated(tokenAddr, newURI);
    }

    // ═════════════════════════════════════════════════════════════
    //  PLATFORM FEE RECEIVE / WITHDRAW
    // ═════════════════════════════════════════════════════════════

    /**
     * @notice Accept ETH from any deployed token/curve as platform fee.
     *         We can't cheaply verify source here without a registry lookup;
     *         we simply accept and account.
     */
    receive() external payable {
        // If the caller is a registered token or curve, bucket it properly.
        // Otherwise, still accept but log as generic deposit.
        accumulatedPlatformFees += msg.value;
        emit PlatformFeeReceived(msg.sender, msg.value);
    }

    function withdrawPlatformFees(address to) external onlyOwner nonReentrant {
        uint256 amount = accumulatedPlatformFees;
        require(amount > 0, "Nothing to withdraw");
        require(to != address(0), "Bad recipient");
        accumulatedPlatformFees = 0;
        totalPlatformFeesWithdrawn += amount;
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH send failed");
        emit PlatformFeesWithdrawn(to, amount);
    }

    // ═════════════════════════════════════════════════════════════
    //  ADMIN: per-token force close + per-token config
    // ═════════════════════════════════════════════════════════════

    function forceCloseCurve(address tokenAddr, address to) external onlyOwner {
        TokenRecord storage r = records[tokenAddr];
        require(r.curve != address(0), "Unknown token");
        AethpadBondingCurveV2(payable(r.curve)).forceCloseAndWithdraw(to);
    }

    function setTokenSwapThreshold(address tokenAddr, uint256 newThreshold) external onlyOwner {
        TokenRecord storage r = records[tokenAddr];
        require(r.token != address(0), "Unknown token");
        AethpadTokenV2(payable(r.token)).setSwapThreshold(newThreshold);
    }

    function setTokenExcluded(address tokenAddr, address account, bool excluded) external onlyOwner {
        TokenRecord storage r = records[tokenAddr];
        require(r.token != address(0), "Unknown token");
        AethpadTokenV2(payable(r.token)).setExcluded(account, excluded);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function getRecord(address tokenAddr) external view returns (TokenRecord memory) {
        return records[tokenAddr];
    }
}
