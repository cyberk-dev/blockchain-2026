// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {FullMath} from "./libraries/FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
  using FullMath for uint256;

  address public feeReceipt;
  uint256 public feePercentage;

  error InvalidAmount();
  error InsufficientFunds();
  error FailedToSendFee();
  error FailedToRefund();

  event TokenBought(address indexed buyer, uint256 amount, uint256 cost, uint256 fee);

  constructor(string memory _name, string memory _symbol,
    address _feeReceipt,
    uint256 _feePercentage
  ) ERC20(_name, _symbol) Ownable(msg.sender) {
    feeReceipt = _feeReceipt;
    feePercentage = _feePercentage;
  }

  function getCost(
    uint256 s, // Current supply
    uint256 m, // Amount to buy
    uint256 _a, // slope
    uint256 _b // base price
  ) public pure returns (uint256) {
    return FullMath.mulDiv(_a.mulDiv(m * (2 * s + m + 1), 2) + _b * m, 1, 1e22);
  }

  function buyToken(uint256 _amount, uint256 _slope, uint256 _intercept) external payable nonReentrant {
    if (_amount == 0) revert InvalidAmount();
    uint256 totalCost = getCost(totalSupply(), _amount, _slope, _intercept);
    uint256 fee = totalCost * feePercentage / 10_000; // 10_000 = 100% 
    
    uint256 totalPayment = totalCost + fee;
    if (msg.value < totalPayment) revert InsufficientFunds();

    (bool success, ) = feeReceipt.call{value: fee}("");
    if (!success) revert FailedToSendFee();

    if (msg.value > totalPayment) {
      uint256 change = msg.value - totalPayment;
      (bool success, ) = msg.sender.call{value: change}("");
      if (!success) revert FailedToRefund();
    }

    _mint(msg.sender, _amount);
    emit TokenBought(msg.sender, _amount, totalCost, fee);
  }
}