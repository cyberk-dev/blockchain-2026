// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20 {
    using SafeERC20 for IERC20;

    uint256 public endTime;
    uint256 public slope;
    uint256 public startingPrice;
    uint256 public tokensSold;
    IERC20 public paymentToken;

    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 totalCost,
        uint256 newTokensSold
    );

    event TokensSold(
        address indexed seller,
        uint256 amount,
        uint256 refundAmount
    );

    modifier notEnded() {
        require(block.timestamp < endTime, "Token: Sale has ended");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        uint256 _endTime,
        uint256 _slope,
        uint256 _startingPrice,
        address _paymentToken
    ) ERC20(name, symbol) {
        require(_endTime > block.timestamp, "Token: End time must be in the future");
        require(_startingPrice > 0, "Token: Starting price must be greater than 0");
        require(_paymentToken != address(0), "Token: Payment token cannot be zero address");

        endTime = _endTime;
        slope = _slope;
        startingPrice = _startingPrice;
        tokensSold = 0;
        paymentToken = IERC20(_paymentToken);

        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
        }
    }

    function getCurrentPrice() public view returns (uint256) {
        return slope * (tokensSold + 1) + startingPrice;
    }

    function getCost(uint256 s, uint256 m, uint256 _a, uint256 _b) public pure returns (uint256 totalCost) {
        if (m == 0) return 0;
        uint256 sumFactor = 2 * s + m + 1;
        uint256 part1 = FullMath.mulDiv(_a * m, sumFactor, 2);
        uint256 part2 = _b * m;
        totalCost = part1 + part2;
    }

    function calculatePurchaseCost(uint256 amount) public view returns (uint256 totalCost) {
        require(amount > 0, "Token: Amount must be greater than 0");
        return getCost(tokensSold, amount, slope, startingPrice);
    }

    function buyToken(uint256 amount) public notEnded {
        require(amount > 0, "Token: Amount must be greater than 0");

        uint256 totalCost = calculatePurchaseCost(amount);

        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);

        tokensSold += amount;
        _mint(msg.sender, amount);

        emit TokensPurchased(msg.sender, amount, totalCost, tokensSold);
    }

    function sellToken(uint256 amount) public {
        require(amount > 0, "Token: Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Token: Insufficient balance");
        require(tokensSold >= amount, "Token: Cannot sell more than tokens sold");

        uint256 S = tokensSold - amount;
        uint256 refundAmount = getCost(S, amount, slope, startingPrice);

        require(paymentToken.balanceOf(address(this)) >= refundAmount, "Token: Insufficient contract balance");

        tokensSold -= amount;
        _burn(msg.sender, amount);

        paymentToken.safeTransfer(msg.sender, refundAmount);

        emit TokensSold(msg.sender, amount, refundAmount);
    }

    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }

    function isSaleActive() public view returns (bool) {
        return block.timestamp < endTime;
    }
}
