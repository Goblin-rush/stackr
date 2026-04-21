// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/v2/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Minimal mock of Uniswap V2 router + factory + pair for testing Aethpad v2.
 *
 * Pair is a dumb address that holds tokens + ETH and behaves like a constant-
 * product AMM for swaps. addLiquidityETH mints LP tokens to `to`. Pair tracks
 * reserves via balance checks.
 */

contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;
    function deposit() external payable {}
    function withdraw(uint256) external {}
}

contract MockUniswapV2Pair {
    address public token0;
    address public token1;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    function initialize(address _t0, address _t1) external { token0 = _t0; token1 = _t1; }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public pairs;
    address public lastPair;

    function createPair(address a, address b) external returns (address) {
        require(pairs[a][b] == address(0), "exists");
        MockUniswapV2Pair p = new MockUniswapV2Pair();
        p.initialize(a, b);
        pairs[a][b] = address(p);
        pairs[b][a] = address(p);
        lastPair = address(p);
        return address(p);
    }

    function getPair(address a, address b) external view returns (address) {
        return pairs[a][b];
    }
}

contract MockUniswapV2Router {
    address public immutable _factory;
    address public immutable _weth;

    constructor(address factoryAddr, address wethAddr) {
        _factory = factoryAddr;
        _weth = wethAddr;
    }

    function factory() external view returns (address) { return _factory; }
    function WETH() external view returns (address) { return _weth; }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256,
        uint256,
        address to,
        uint256
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        // Pull tokens
        IERC20(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        // "Mint" LP
        liquidity = amountTokenDesired + msg.value;
        amountToken = amountTokenDesired;
        amountETH = msg.value;
        // Register pair if not exists
        address pair = MockUniswapV2Factory(_factory).getPair(token, _weth);
        if (pair == address(0)) {
            pair = MockUniswapV2Factory(_factory).createPair(token, _weth);
        }
        MockUniswapV2Pair(pair).mint(to, liquidity);
        // Park tokens + ETH in this router as "pool" for later swaps
    }

    // Very simplified swap — treats this contract as the pool.
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external {
        address token = path[0];
        IERC20(token).transferFrom(msg.sender, address(this), amountIn);
        // Give back tiny fraction as ETH (mock price: 0.0001 ETH per token unit for test)
        uint256 ethOut = amountIn / 1e4; // dumb rate for test
        if (ethOut > address(this).balance) ethOut = address(this).balance;
        (bool ok, ) = payable(to).call{value: ethOut}("");
        require(ok, "send");
    }

    receive() external payable {}
}
