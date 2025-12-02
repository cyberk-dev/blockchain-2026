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
    address public feeReceipt;
    uint256 public transactionFeePercentage; // Basis points

    error InsufficientPayment();
    error InsufficientContractBalance();
    error AmountCannotBeZero();
    error FeeReceiptCannotBeZeroAddress();

    uint256 constant SCALE = 1e22;

    // Event emitted when tokens are purchased
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost, uint256 fee);

    constructor(
        string memory name,
        string memory symbol,
        address usdt_address,
        address _feeReceipt,
        uint256 _transactionFeePercentage
    ) ERC20(name, symbol) Ownable(msg.sender) {
        if (_feeReceipt == address(0)) revert FeeReceiptCannotBeZeroAddress();
        usdt = IERC20(usdt_address);
        feeReceipt = _feeReceipt;
        transactionFeePercentage = _transactionFeePercentage;
    }

    // Linear bonding curve: y = ax + b
    // Cost calculation uses the arithmetic progression sum formula.
    // Proof: https://www.wolframalpha.com/input?i=sum+%28a*x+%2B+b%29+for+x+from+s%2B1+to+s%2Bm
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
        uint256 totalCost = getCost(totalSupply(), amount, _slope, _intercept);
        
        uint256 feeAmount = totalCost.mulDiv(transactionFeePercentage, 10000);
        uint256 netAmount = totalCost - feeAmount;

        // Transfer fee to feeReceipt
        if (feeAmount > 0) {
            usdt.safeTransferFrom(msg.sender, feeReceipt, feeAmount);
        }

        // Transfer net amount to this contract (reserve)
        if (netAmount > 0) {
            usdt.safeTransferFrom(msg.sender, address(this), netAmount);
        }

        _mint(msg.sender, amount);
        emit TokensPurchased(msg.sender, amount, totalCost, feeAmount);
    }
}
