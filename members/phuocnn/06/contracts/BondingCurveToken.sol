// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BondingCurveToken is ERC20, Ownable {
    // Parameters for Linear Bonding Curve: y = ax + b
    // Scale: We assume a and b are in wei precision relative to token supply unit
    uint256 public a; // Slope
    uint256 public b; // Initial price

    address public feeReceipt;
    uint256 public buyFeePercent; // e.g., 5 means 5%

    // Exercise 5.3: Events
    event TokensPurchased(
        address indexed buyer,
        uint256 amountOfTokens,
        uint256 totalCost,
        uint256 feeAmount
    );

    constructor(
        string memory name,
        string memory symbol,
        uint256 _a,
        uint256 _b,
        address _feeReceipt,
        uint256 _buyFeePercent,
        address _owner
    ) ERC20(name, symbol) Ownable(_owner) {
        a = _a;
        b = _b;
        feeReceipt = _feeReceipt;
        buyFeePercent = _buyFeePercent;
    }

    // Exercise 5.1: Calculate Cost
    // WolframAlpha Proof: https://www.wolframalpha.com/input?i=integrate+%28a*x+%2B+b%29+dx+from+S+to+S%2Bk
    // Integral of (ax + b) is (a/2)x^2 + bx
    // Cost to buy 'amount' tokens starting from 'currentSupply':
    // Cost = F(currentSupply + amount) - F(currentSupply)
    function calculateCost(uint256 amount) public view returns (uint256) {
        uint256 currentSupply = totalSupply();
        uint256 nextSupply = currentSupply + amount;

        // F(x) = (a * x^2) / 2 + b * x
        // To avoid precision loss with division, we do multiplication first.
        // We use 1e18 scaling if needed, but here we keep it raw for simplicity as requested.

        uint256 term1 = (a * nextSupply * nextSupply) / 2 + (b * nextSupply);
        uint256 term2 = (a * currentSupply * currentSupply) /
            2 +
            (b * currentSupply);

        return term1 - term2;
    }

    // Exercise 5.3: Buy Token with Fees
    function buy(uint256 amount) external payable {
        require(amount > 0, "Amount must be greater than 0");

        uint256 cost = calculateCost(amount);

        // Exercise 5.3: Calculate Fee (y%)
        uint256 fee = (cost * buyFeePercent) / 100;
        uint256 totalRequired = cost + fee;

        require(msg.value >= totalRequired, "Insufficient ETH sent");

        // Mint tokens to buyer
        _mint(msg.sender, amount);

        // Send fee to fee_receipt
        (bool successFee, ) = feeReceipt.call{value: fee}("");
        require(successFee, "Fee transfer failed");

        // Refund excess ETH (if any)
        uint256 refund = msg.value - totalRequired;
        if (refund > 0) {
            (bool successRefund, ) = msg.sender.call{value: refund}("");
            require(successRefund, "Refund failed");
        }

        // Emit Event
        emit TokensPurchased(msg.sender, amount, totalRequired, fee);
    }
}
