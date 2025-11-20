// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract BondingCurveToken is ERC20, Ownable {
    uint256 public immutable a;
    uint256 public immutable b;
    uint256 public totalSold;
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 costWei);

    error AmountMustBeGreaterThanZero();
    error InsufficientPayment(uint256 required, uint256 provided);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 a_,
        uint256 b_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        a = a_;
        b = b_;
        _mint(msg.sender, initialSupply_);
    }

    function getPrice(uint256 amount) public view returns (uint256) {
      return a * amount + b;
    }

    function currentPrice() external view returns (uint256) {
      return getPrice(totalSold);
    }

    function calculateCost(uint256 amountTokens) public view returns (uint256) {
        uint256 s = totalSold;
        uint256 n = amountTokens;
        
        uint256 term1 = a * n * s;
        uint256 term2 = (a * n * (n + 1)) / 2;
        uint256 term3 = b * n;

        uint256 cost = term1 + term2 + term3;
        return cost;
    }

    function buyTokens(uint256 amountTokens) external payable {
        if (amountTokens == 0) {
            revert AmountMustBeGreaterThanZero();
        }

        uint256 cost = calculateCost(amountTokens);
        if (msg.value < cost) {
            revert InsufficientPayment(cost, msg.value);
        }

        totalSold += amountTokens;
        _mint(msg.sender, amountTokens * (10 ** decimals()));

        emit TokensPurchased(msg.sender, amountTokens, cost);

        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }
}