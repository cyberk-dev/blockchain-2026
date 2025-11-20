// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "hardhat/console.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    uint256 price;
    uint256 endTime;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        uint256 _endTime
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        price = 0.1 ether;
        _mint(msg.sender, _initialSupply);

        endTime = _endTime;
    }

    error InsufficientFunds();
    error InvalidAmount();
    error SaleEnded();

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    modifier saleActive() {
        console.log(block.timestamp, endTime);
        if (block.timestamp > endTime) revert SaleEnded();
        _;
    }

    function buyToken(
        uint256 _amount
    ) external payable saleActive nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        if (msg.value.mulDivRoundingUp(10 ** decimals(), price) < _amount)
            revert InsufficientFunds();
        _mint(msg.sender, _amount);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
