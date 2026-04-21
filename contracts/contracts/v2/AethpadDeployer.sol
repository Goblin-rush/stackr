// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AethpadTokenV2.sol";
import "./AethpadBondingCurveV2.sol";

/**
 * @title AethpadDeployer
 * @notice Thin helper that deploys AethpadTokenV2 + AethpadBondingCurveV2
 *         pairs. Keeping deployment bytecode here lets the Factory stay
 *         under the 24KB contract size limit.
 */
contract AethpadDeployer {
    address public immutable factory;
    address public immutable uniswapRouter;

    constructor(address _factory, address _uniswapRouter) {
        factory = _factory;
        uniswapRouter = _uniswapRouter;
    }

    function deployPair(
        string calldata name,
        string calldata symbol
    ) external returns (address tokenAddr, address curveAddr) {
        require(msg.sender == factory, "Only factory");
        AethpadBondingCurveV2 curve = new AethpadBondingCurveV2(factory, uniswapRouter);
        curveAddr = address(curve);
        AethpadTokenV2 token = new AethpadTokenV2(name, symbol, factory, curveAddr);
        tokenAddr = address(token);
        curve.initToken(tokenAddr);
    }
}
