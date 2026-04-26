// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  StackrTokenV4
 * @notice Clean ERC-20 launched by StackrFactoryV4. Total supply is minted to the
 *         factory at deployment; the factory immediately seeds the bonding curve
 *         with the entire supply (800M for sale on the curve, 200M reserved for the
 *         post-bond Uniswap V2 LP). No tax, no hooks, no mint, no pause.
 */
contract StackrTokenV4 is ERC20 {
    string public metadataURI;
    address public immutable factory;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _metadataURI,
        address _factory
    ) ERC20(_name, _symbol) {
        require(_factory != address(0), "Bad factory");
        metadataURI = _metadataURI;
        factory = _factory;
        _mint(_factory, TOTAL_SUPPLY);
    }

    /// @notice Burn caller's tokens (deflationary, anyone can call on themselves)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
