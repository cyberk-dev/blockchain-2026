// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IToken.sol";

contract Token is
    IToken,
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    error InsufficientFunds();
    error AmountCannotBeZero();

    event TokenBought(address indexed buyer, uint256 amount, uint256 cost);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address owner
    ) public initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(owner);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function buyToken(uint256 _amount) external payable {
        if (_amount == 0) revert AmountCannotBeZero();
        uint256 cost = _amount * 0.000000000001 ether;
        if (msg.value < cost) revert InsufficientFunds();
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
        _mint(msg.sender, _amount);
        emit TokenBought(msg.sender, _amount, cost);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
