// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BondingCurve is ERC20 {
    using SafeERC20 for IERC20;

    uint256 public constant SLOPE = 1e22;
    uint256 public constant INITIAL_PRICE = 10e22;
    uint256 public constant SCALE = 1e22;

    uint256 public constant FEE_BASIS_POINTS = 200;
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    IERC20 public immutable paymentToken;
    address public feeRecipient;

    event TokensPurchased(
        address indexed buyer,
        uint256 amountTokens,
        uint256 cost,
        uint256 fee,
        uint256 newSupply
    );

    event TokensSold(
        address indexed seller,
        uint256 amountTokens,
        uint256 refund,
        uint256 newSupply
    );

    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    constructor(
        string memory name,
        string memory symbol,
        address _paymentToken,
        address _feeRecipient
    ) ERC20(name, symbol) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }

    function calculateBuyCost(uint256 amount) public view returns (uint256) {
        uint256 currentSupply = totalSupply();
        uint256 newSupply = currentSupply + amount;

        uint256 avgSupply = (newSupply + currentSupply) / 2;
        uint256 costFromSlope = (SLOPE * avgSupply * amount) / SCALE;
        uint256 costFromBase = (INITIAL_PRICE * amount) / SCALE;

        return costFromSlope + costFromBase;
    }

    function calculateSellRefund(uint256 amount) public view returns (uint256) {
        uint256 currentSupply = totalSupply();
        require(currentSupply >= amount, "Not enough supply");

        uint256 newSupply = currentSupply - amount;

        uint256 avgSupply = (currentSupply + newSupply) / 2;
        uint256 refundFromSlope = (SLOPE * avgSupply * amount) / SCALE;
        uint256 refundFromBase = (INITIAL_PRICE * amount) / SCALE;

        return refundFromSlope + refundFromBase;
    }

    function buyTokens(uint256 amount) external {
        require(amount > 0, "Amount must be positive");

        uint256 baseCost = calculateBuyCost(amount);
        uint256 fee = (baseCost * FEE_BASIS_POINTS) / BASIS_POINTS_DIVISOR;
        uint256 totalCost = baseCost + fee;

        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);

        if (fee > 0) {
            paymentToken.safeTransfer(feeRecipient, fee);
        }

        _mint(msg.sender, amount);

        emit TokensPurchased(msg.sender, amount, baseCost, fee, totalSupply());
    }

    function sellTokens(uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        uint256 refund = calculateSellRefund(amount);

        _burn(msg.sender, amount);

        paymentToken.safeTransfer(msg.sender, refund);

        emit TokensSold(msg.sender, amount, refund, totalSupply());
    }

    function setFeeRecipient(address newRecipient) external {
        require(msg.sender == feeRecipient, "Only fee recipient can update");
        require(newRecipient != address(0), "Invalid address");

        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;

        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function getCurrentPrice() external view returns (uint256) {
        uint256 currentSupply = totalSupply();
        return (SLOPE * currentSupply) / SCALE + INITIAL_PRICE / SCALE;
    }
}
