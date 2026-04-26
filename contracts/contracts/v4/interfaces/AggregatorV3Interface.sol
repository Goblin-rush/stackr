// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  AggregatorV3Interface
 * @notice Minimal Chainlink price-feed surface used by StackrFactoryV3.
 *         Matches the canonical Chainlink interface so any AggregatorV3-compatible
 *         feed can be plugged in (Chainlink, RedStone, Pyth proxy, etc.).
 *
 *  ETH mainnet feed used by Stackr:
 *    ETH/USD: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 (8 decimals)
 */
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function version() external view returns (uint256);

    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );
}
