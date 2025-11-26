// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
contract Token is ERC20, Ownable, ReentrancyGuard {
  using FullMath for uint256;
  using SafeERC20 for IERC20;
  uint256 public price;

  IERC20 public usdt;

  event TokenBought(address indexed buyer, uint256 amount, uint256 cost);

  error InsufficientFunds();
  error InvalidAmount();
  error EndTimeReached();

  constructor (address _usdt) ERC20("Liquidity Token", "LTK") Ownable(msg.sender) {
    usdt = IERC20(_usdt);
  }


  function buyToken(uint256 _amount, uint256 _slope, uint256 _intercept) external payable nonReentrant {
    if (_amount == 0) revert InvalidAmount();
    
    uint256 totalCost = getCost(totalSupply(), _amount, _slope, _intercept);
    usdt.safeTransferFrom(msg.sender, address(this), totalCost);
    _mint(msg.sender,_amount);
    emit TokenBought(msg.sender, _amount, totalCost);
  }

  function getCost(
    uint256 s, // Current supply
    uint256 m, // Amount to buy
    uint256 _a, // slope
    uint256 _b // base price
  ) public pure returns (uint256) {
    return FullMath.mulDiv(_a.mulDiv(m * (2 * s + m + 1), 2) + _b * m, 1, 1e22);
  } 
}