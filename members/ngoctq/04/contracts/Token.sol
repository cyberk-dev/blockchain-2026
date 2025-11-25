// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./libraries/FullMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Token is
    ERC20,
    ERC20Burnable,
    Ownable,
    ReentrancyGuard
{
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public usdt;

    error InsufficientPayment();
    error InsufficientContractBalance();
    error AmountCannotBeZero();

    uint256 constant SCALE = 1e22;

    event TokenBought(address indexed buyer, uint256 amount, uint256 cost);

    constructor(
        string memory name,
        string memory symbol,
        address usdt_address
    ) ERC20(name, symbol) Ownable(msg.sender) {
        usdt = IERC20(usdt_address);
    }

    function getCost(
        uint256 s, // current supply
        uint256 m, // amount to buy
        uint256 _a, // slope
        uint256 _b // intercept
    ) public pure returns (uint256) {
        return _a.mulDiv(m * (2 * s + m + 1), 2 * SCALE) + _b.mulDiv(m, SCALE);
    }

    function buyTokens(uint256 amount, uint256 _slope, uint256 _intercept) external nonReentrant {
        if (amount == 0) revert AmountCannotBeZero();
        uint256 cost = getCost(totalSupply(), amount, _slope, _intercept);
        // Transfer USDT from buyer to this contract
        usdt.safeTransferFrom(msg.sender, address(this), cost);
        _mint(msg.sender, amount);
        emit TokenBought(msg.sender, amount, cost);
    }
}
