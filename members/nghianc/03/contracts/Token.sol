// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FullMath} from "./FullMath.sol";

/**
 * @title Token
 * @dev ERC20 token with time-limited sales and progressive pricing
 * @notice Price follows formula: y = ax + b, where x is total tokens sold
 */
contract Token is ERC20 {
    /// @notice End time for token purchases (Unix timestamp)
    uint256 public endTime;

    /// @notice Slope 'a' in pricing formula y = ax + b (price increase per token in wei)
    uint256 public slope;

    /// @notice Starting price 'b' in pricing formula y = ax + b (base price in wei)
    uint256 public startingPrice;

    /// @notice Total number of tokens sold through buyToken function
    uint256 public tokensSold;

    /// @notice Event emitted when tokens are purchased
    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 totalCost,
        uint256 newTokensSold
    );

    /// @notice Event emitted when tokens are sold back
    event TokensSold(
        address indexed seller,
        uint256 amount,
        uint256 refundAmount
    );

    /// @notice Modifier to check if the sale period has not ended
    modifier notEnded() {
        require(block.timestamp < endTime, "Token: Sale has ended");
        _;
    }

    /**
     * @notice Constructor to initialize the token with progressive pricing
     * @param name Token name
     * @param symbol Token symbol
     * @param _initialSupply Initial supply minted to deployer
     * @param _endTime Unix timestamp when token sale ends
     * @param _slope Price increase per token sold (in wei)
     * @param _startingPrice Base price of first token (in wei)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        uint256 _endTime,
        uint256 _slope,
        uint256 _startingPrice
    ) ERC20(name, symbol) {
        require(_endTime > block.timestamp, "Token: End time must be in the future");
        require(_startingPrice > 0, "Token: Starting price must be greater than 0");

        endTime = _endTime;
        slope = _slope;
        startingPrice = _startingPrice;
        tokensSold = 0;

        if (_initialSupply > 0) {
            _mint(msg.sender, _initialSupply);
        }
    }

    /**
     * @notice Calculate the price of the next token to be sold
     * @return price Price of the next token in wei
     */
    function getCurrentPrice() public view returns (uint256) {
        // y = a * (x + 1) + b, where x is current tokensSold
        return slope * (tokensSold + 1) + startingPrice;
    }

    /**
     * @notice Calculate the total cost to buy a specific amount of tokens
     * @dev Uses arithmetic series sum formula: Sum(i=S+1 to S+N) of (a*i + b) = a*N*(2S + N + 1)/2 + b*N
     * @param amount Number of tokens to buy
     * @return totalCost Total cost in wei
     */
    function calculatePurchaseCost(uint256 amount) public view returns (uint256 totalCost) {
        require(amount > 0, "Token: Amount must be greater than 0");

        uint256 S = tokensSold; // Current tokens sold
        uint256 N = amount;     // Tokens to buy

        // Formula: Total = a * N * (2S + N + 1) / 2 + b * N
        // Breaking it down:
        // Part 1: a * N * (2S + N + 1) / 2
        // Part 2: b * N

        // Calculate (2S + N + 1)
        uint256 sumFactor = 2 * S + N + 1;

        // Part 1: Use FullMath to safely calculate a * N * sumFactor / 2
        uint256 part1 = FullMath.mulDiv(slope * N, sumFactor, 2);

        // Part 2: b * N
        uint256 part2 = startingPrice * N;

        totalCost = part1 + part2;

        return totalCost;
    }

    /**
     * @notice Buy tokens with progressive pricing
     * @dev Price increases based on total tokens sold: y = ax + b
     * @param amount Number of tokens to purchase
     */
    function buyToken(uint256 amount) public payable notEnded {
        require(amount > 0, "Token: Amount must be greater than 0");

        // Calculate total cost using progressive pricing formula
        uint256 totalCost = calculatePurchaseCost(amount);

        require(msg.value >= totalCost, "Token: Insufficient ETH sent");

        // Update tokens sold counter
        tokensSold += amount;

        // Mint tokens to buyer
        _mint(msg.sender, amount);

        // Refund excess ETH if any
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit TokensPurchased(msg.sender, amount, totalCost, tokensSold);
    }

    /**
     * @notice Sell tokens back to the contract
     * @dev Refund is calculated at the average price of the last N tokens sold
     * @param amount Number of tokens to sell
     */
    function sellToken(uint256 amount) public {
        require(amount > 0, "Token: Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Token: Insufficient balance");
        require(tokensSold >= amount, "Token: Cannot sell more than tokens sold");

        // Calculate refund based on the price of the last 'amount' tokens
        // This is the reverse of buying - we calculate what those tokens cost
        uint256 S = tokensSold - amount; // Start position for refund calculation
        uint256 N = amount;

        // Formula: Total = a * N * (2S + N + 1) / 2 + b * N
        uint256 sumFactor = 2 * S + N + 1;
        uint256 part1 = FullMath.mulDiv(slope * N, sumFactor, 2);
        uint256 part2 = startingPrice * N;
        uint256 refundAmount = part1 + part2;

        // Ensure contract has enough ETH
        require(address(this).balance >= refundAmount, "Token: Insufficient contract balance");

        // Update tokens sold counter
        tokensSold -= amount;

        // Burn the tokens
        _burn(msg.sender, amount);

        // Send ETH refund
        payable(msg.sender).transfer(refundAmount);

        emit TokensSold(msg.sender, amount, refundAmount);
    }

    /**
     * @notice Get the time remaining until sale ends
     * @return Time remaining in seconds, or 0 if sale has ended
     */
    function getTimeRemaining() public view returns (uint256) {
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }

    /**
     * @notice Check if the sale is still active
     * @return True if sale is active, false otherwise
     */
    function isSaleActive() public view returns (bool) {
        return block.timestamp < endTime;
    }

    /// @notice Allow contract to receive ETH
    receive() external payable {}
}