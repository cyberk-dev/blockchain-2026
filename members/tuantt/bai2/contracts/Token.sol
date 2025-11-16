// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Token is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable
{
    error OnlyMinter();

    address _minter;

    modifier onlyMinter() {
        if (msg.sender != _minter) revert OnlyMinter();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol
    ) external initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(msg.sender);
    }

    function setMinter(address minter) external onlyOwner {
        _minter = minter;
    }

    function mintTokens(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burnTokens(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }
}
