// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    // Bonding curve parameters: y = ax + b
    // y: price of token
    // x: total number of tokens sold (including current purchase)
    // a: slope (rate of price increase)
    // b: starting price
    uint256 public a; // slope
    uint256 public b; // starting price
    uint256 public totalSold; // total tokens sold (excluding initial supply)
    uint256 public endTime; // time limit for token purchase

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
        uint256 _initialSupply
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        // Set bonding curve parameters
        // Example: a = 0.001 ether (1e15), b = 0.1 ether (1e17)
        // This means: price = 0.001 * x + 0.1 (in ether)
        a = 0.001 ether; // 1 * 10^15
        b = 0.1 ether; // 1 * 10^17

        // Set endTime to 1 hour after deployment
        endTime = block.timestamp + 1 hours;

        totalSold = 0;
        _mint(msg.sender, _initialSupply);
    }

    /**
     * @dev Calculate the total cost to buy N tokens when S tokens have already been sold
     * Formula: Sum from i=1 to N of (a * (S + i) + b)
     * Simplified: N * (a * S + a * (N + 1) / 2 + b)
     * Note: _amount and totalSold are in wei (with 18 decimals), but formula uses token count
     * @param _amount Number of tokens to buy (in wei)
     * @return totalCost Total cost in wei
     */
    function calculateCost(
        uint256 _amount
    ) public view returns (uint256 totalCost) {
        if (_amount == 0) return 0;

        // Convert from wei to token count (divide by 10^18)
        uint256 S = totalSold / (10 ** decimals()); // tokens sold
        uint256 N = _amount / (10 ** decimals()); // tokens to buy

        // Calculate: N * (a * S + a * (N + 1) / 2 + b)
        // Using FullMath to avoid overflow

        // a * S
        uint256 aS = a.mulDiv(S, 1);

        // a * (N + 1) / 2
        uint256 aNPlus1Over2 = a.mulDiv(N + 1, 2);

        // Average price per token: a * S + a * (N + 1) / 2 + b
        uint256 avgPricePerToken = aS + aNPlus1Over2 + b;

        // Total cost: N * avgPricePerToken
        totalCost = N.mulDiv(avgPricePerToken, 1);
    }

    /**
     * @dev Buy tokens using bonding curve pricing
     * @param _amount Number of tokens to buy
     */
    function buyToken(
        uint256 _amount
    ) external payable onlyBeforeEndTime nonReentrant {
        if (_amount == 0) revert InvalidAmount();

        // Calculate total cost based on bonding curve
        uint256 requiredCost = calculateCost(_amount);

        if (msg.value < requiredCost) revert InsufficientFunds();

        // Update total sold before minting
        totalSold += _amount;

        // Mint tokens to buyer
        _mint(msg.sender, _amount);

        // Refund excess ETH if any
        if (msg.value > requiredCost) {
            payable(msg.sender).transfer(msg.value - requiredCost);
        }
    }

    /**
     * @dev Get current price for the next token to be sold
     * @return Current price in wei
     */
    function getCurrentPrice() public view returns (uint256) {
        // Convert totalSold from wei to token count
        uint256 tokensSold = totalSold / (10 ** decimals());
        // Price of next token: a * (tokensSold + 1) + b
        return a.mulDiv(tokensSold + 1, 1) + b;
    }

    /**
     * @dev Get price for a specific token index (1-indexed)
     * @param tokenIndex Token index (1 = first token, 2 = second token, etc.)
     * @return Price in wei for that specific token
     */
    function getTokenPrice(uint256 tokenIndex) public view returns (uint256) {
        // Price of token at index: a * tokenIndex + b
        return a.mulDiv(tokenIndex, 1) + b;
    }

    /**
     * @dev Get prices for a range of tokens
     * @param startIndex Starting token index (1-indexed)
     * @param count Number of tokens
     * @return prices Array of prices in wei
     */
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
