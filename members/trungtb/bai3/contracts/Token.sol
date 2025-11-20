// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
  using FullMath for uint256;

  uint256 public price;

  uint256 public endTime;

  uint256 public slope;
  uint256 public basePrice;
  uint256 public totalSold;

  error InsufficientFunds();
  error InvalidAmount();
  error EndTimeReached();

  constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
  ERC20(_name, _symbol) Ownable(msg.sender)
  {
    basePrice = 0.1 ether;
    slope = 0.0001 ether;
    totalSold = 0;
    endTime = block.timestamp + 1 hours;
    _mint(msg.sender, _initialSupply);
  }
  
  function setPrice(uint256 _price) external onlyOwner {
    price = _price;
  }

  modifier onlyBeforeEndTime() {
    if (block.timestamp >= endTime) revert EndTimeReached();
    _;
  }

  function buyToken(uint256 _amount) external payable nonReentrant onlyBeforeEndTime{
    if (_amount == 0) revert InvalidAmount();
    
    uint256 totalCost = calculateTotalCost(_amount);
    if (msg.value < totalCost) revert InsufficientFunds();

    totalSold += _amount;

    _mint(msg.sender,_amount);
  }

  function calculateTotalCost(uint256 _amount) internal view returns (uint256) {
    // Convert wei to token amount (assuming 18 decimals)
    // S and N are in token units, not wei
    uint256 S = totalSold / 1e18;  // Convert totalSold from wei to tokens
    uint256 N = _amount / 1e18;    // Convert _amount from wei to tokens

    // Sum = a * N * (2*S + N + 1) / 2 + b * N
    // Calculate: slope * N * (2*S + N + 1) / 2
    uint256 term = 2 * S + N + 1;
    uint256 slopeTimesN = slope * N;
    uint256 part1 = FullMath.mulDiv(slopeTimesN, term, 2);
    
    // Calculate: basePrice * N
    uint256 part2 = basePrice * N;
    
    return part1 + part2;
  }
}