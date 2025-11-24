// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { FullMath } from "./FullMath.sol";

contract Token is ERC20, Ownable {

    using FullMath for uint256;
    
    // cost (s,m) = m*(1 + 2ab + m + 2s) / (2a)
    // (b) parameters for bonding curve
    uint256 public initialPrice;
    // (a) parameters for bonding curve = 1e10
    uint256 public slope;
    // (s) total sold tokens
    uint256 public totalSold;
    event Bought(address indexed user, uint256 amountToken, uint256 cost);

    error AmountZero();
    error InsufficientPayment(uint256 required, uint256 provided);

  constructor(string memory name_, string memory symbol_, uint256 slope_, uint256 initialPrice_) ERC20(name_, symbol_) Ownable(msg.sender) {
    slope = slope_;
    initialPrice = initialPrice_;
    _mint(msg.sender, 1000 * 10 ** decimals());
  }

  // Buy `amount` tokens, paying the required cost (n = amount, s = totalSold)
  function calculateCost(uint256 n, uint256 s) public view returns (uint256) {
      // cost (s,m) = m*(1 + 2ab + m + 2s) / (2a)
      uint256 numerator = n * (1 + (2 * slope * initialPrice) + n + (2 * s));
      uint256 denominator = 2 * slope;

      return numerator.mulDivRoundingUp(1, denominator);
  }

  function buyToken(uint256 amountToken) external payable {
    if (amountToken == 0) {
        revert AmountZero();
    }

    uint256 cost = calculateCost(amountToken, totalSold);
    if (msg.value < cost) {
        revert InsufficientPayment(cost, msg.value);
    }

    totalSold += amountToken;
    uint256 mintAmount = amountToken * 10 ** decimals();
    _mint(msg.sender, mintAmount);

    uint256 refund = msg.value - cost;
    if (refund > 0) {
        payable(msg.sender).transfer(refund);
    }

    emit Bought(msg.sender, amountToken, cost);
  }
}