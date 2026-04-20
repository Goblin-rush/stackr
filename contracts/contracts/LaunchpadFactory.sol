// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BondingCurveLaunchpad.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LaunchpadFactory
 * @notice Anyone can launch a new bonding curve token through this factory.
 *         The factory owner is set as the admin of every deployed token,
 *         so all ETH from every bonding curve auto-forwards to the factory owner.
 */
contract LaunchpadFactory is Ownable {

    // ─── State ────────────────────────────────────────────────────
    address[] public allTokens;
    mapping(address => address[]) public tokensByCreator;

    // ─── Events ───────────────────────────────────────────────────
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string  name,
        string  symbol,
        uint256 index
    );

    // ─── Constructor ──────────────────────────────────────────────
    constructor(address _owner) Ownable(_owner) {}

    // ─── Create Token ─────────────────────────────────────────────
    /**
     * @notice Deploy a new BondingCurveLaunchpad token.
     *         factory owner is set as admin so all raised ETH
     *         auto-forwards to the factory owner on graduation.
     * @param _name   ERC-20 token name  (e.g. "Doge Moon")
     * @param _symbol ERC-20 token symbol (e.g. "DMON")
     * @return token  Address of the newly deployed token contract
     */
    function createToken(
        string calldata _name,
        string calldata _symbol
    ) external returns (address token) {
        BondingCurveLaunchpad newToken = new BondingCurveLaunchpad(
            _name,
            _symbol,
            owner()   // ← factory owner is admin of every token
        );

        token = address(newToken);
        allTokens.push(token);
        tokensByCreator[msg.sender].push(token);

        emit TokenCreated(token, msg.sender, _name, _symbol, allTokens.length - 1);
    }

    // ─── Views ────────────────────────────────────────────────────
    /**
     * @notice Total number of tokens launched via this factory.
     */
    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice All tokens launched by a specific address.
     */
    function getTokensByCreator(address _creator) external view returns (address[] memory) {
        return tokensByCreator[_creator];
    }

    /**
     * @notice Get a paginated list of all tokens (newest first).
     * @param offset  Starting index
     * @param limit   Max number of results
     */
    function getTokens(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result)
    {
        uint256 total = allTokens.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;
        result = new address[](end - offset);

        // Return newest first
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = allTokens[total - 1 - offset - i];
        }
    }
}
