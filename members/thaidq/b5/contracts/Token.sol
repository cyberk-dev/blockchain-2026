// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    // Bonding curve parameters: y = ax + b
    uint256 public a; // slope
    uint256 public b; // starting price
    uint256 public totalSold; // total tokens sold (excluding initial supply)
    uint256 public endTime; // time limit for token purchase
    address public feeReceipt; // address to receive transaction fees
    uint256 public feePercentage; // transaction fee percentage (in basis points, e.g., 100 = 1%)

    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 totalCost,
        uint256 feeAmount
    );

    error InsufficientFunds();
    error InvalidAmount();
    error PurchaseTimeEnded();

    modifier onlyBeforeEndTime() {
        if (block.timestamp >= endTime) revert PurchaseTimeEnded();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        uint256 _slope,
        uint256 _basePrice,
        address _feeReceipt,
        uint256 _feePercentage
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        a = _slope;
        b = _basePrice;
        endTime = block.timestamp + 1 hours;
        totalSold = 0;
        feeReceipt = _feeReceipt;
        feePercentage = _feePercentage; // in basis points (100 = 1%, 10000 = 100%)
        _mint(msg.sender, _initialSupply);
    }

    function calculateCost(
        uint256 _amount
    ) public view returns (uint256 totalCost) {
        if (_amount == 0) return 0;
        // Simplified formula: (m * (1 + 2 * a * b + m + 2 * s)) / (2 * a)
        // m = _amount (in wei), s = totalSold (in wei)
        uint256 twoAB = (2 * a).mulDiv(b, 1); // 2 * a * b
        uint256 twoS = 2 * totalSold; // 2 * s
        uint256 numeratorInner = 1 + twoAB + _amount + twoS; // 1 + 2*a*b + m + 2*s
        uint256 numerator = _amount.mulDiv(numeratorInner, 1); // m * (1 + 2*a*b + m + 2*s)
        uint256 denominator = 2 * a;
        totalCost = numerator.mulDiv(1, denominator);
    }

    function buyToken(
        uint256 _amount
    ) external payable onlyBeforeEndTime nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        uint256 requiredCost = calculateCost(_amount);
        if (msg.value < requiredCost) revert InsufficientFunds();

        // Calculate transaction fee (percentage of requiredCost)
        uint256 feeAmount = requiredCost.mulDiv(feePercentage, 10000);
        uint256 netAmount = requiredCost - feeAmount;

        // Transfer fee to fee receipt
        if (feeAmount > 0 && feeReceipt != address(0)) {
            payable(feeReceipt).transfer(feeAmount);
        }

        // Update state and mint tokens
        totalSold += _amount;
        _mint(msg.sender, _amount);

        // Refund excess ETH if any
        if (msg.value > requiredCost) {
            payable(msg.sender).transfer(msg.value - requiredCost);
        }

        // Emit event
        emit TokensPurchased(msg.sender, _amount, requiredCost, feeAmount);
    }

    function getCurrentPrice() public view returns (uint256) {
        // Convert totalSold from wei to token count
        uint256 tokensSold = totalSold / (10 ** decimals());
        // Price of next token: a * (tokensSold + 1) + b
        return a.mulDiv(tokensSold + 1, 1) + b;
    }

    function getTokenPrice(uint256 tokenIndex) public view returns (uint256) {
        // Price of token at index: a * tokenIndex + b
        return a.mulDiv(tokenIndex, 1) + b;
    }

    function getTokenPrices(
        uint256 startIndex,
        uint256 count
    ) public view returns (uint256[] memory prices) {
        prices = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            prices[i] = getTokenPrice(startIndex + i);
        }
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
