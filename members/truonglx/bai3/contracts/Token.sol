// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    // Sale configuration
    uint256 public saleStartTime;
    uint256 public saleEndTime;
    uint256 public tokensForSale;
    uint256 public tokensSold;

    // Linear pricing: y = ax + b
    // a: slope (price increase per token, in wei per token)
    // b: starting price (price of first token, in wei)
    uint256 public slope; // a in the formula y = ax + b
    uint256 public startingPrice; // b in the formula y = ax + b

    // Treasury address to receive ETH from purchases
    address public treasury;

    // Events
    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 totalCost,
        uint256 pricePerToken
    );
    event SaleConfigured(
        uint256 startTime,
        uint256 endTime,
        uint256 tokensForSale,
        uint256 slope,
        uint256 startingPrice
    );

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        _mint(msg.sender, _initialSupply);
        treasury = msg.sender;
    }

    /**
     * @dev Configure the token sale with time limits and linear pricing
     * @param _saleStartTime Unix timestamp when sale starts
     * @param _saleEndTime Unix timestamp when sale ends
     * @param _tokensForSale Amount of tokens available for sale
     * @param _slope Slope (a) in the formula y = ax + b (price increase per token, in wei per token)
     * @param _startingPrice Starting price (b) in the formula y = ax + b (price of first token, in wei)
     */
    function configureSale(
        uint256 _saleStartTime,
        uint256 _saleEndTime,
        uint256 _tokensForSale,
        uint256 _slope,
        uint256 _startingPrice
    ) external onlyOwner {
        require(_saleStartTime < _saleEndTime, "Invalid sale period");
        require(_tokensForSale > 0, "Tokens for sale must be > 0");
        require(_startingPrice > 0, "Starting price must be > 0");
        require(
            balanceOf(msg.sender) >= _tokensForSale,
            "Insufficient tokens in contract"
        );

        saleStartTime = _saleStartTime;
        saleEndTime = _saleEndTime;
        tokensForSale = _tokensForSale;
        slope = _slope;
        startingPrice = _startingPrice;
        tokensSold = 0;

        emit SaleConfigured(
            _saleStartTime,
            _saleEndTime,
            _tokensForSale,
            _slope,
            _startingPrice
        );
    }

    /**
     * @dev Calculate the current price per token based on linear pricing y = ax + b
     * @return price Current price per token in wei
     * @notice Price of the next token to be sold (token number = tokensSold + 1)
     */
    function getCurrentPrice() public view returns (uint256 price) {
        // Token number (1-indexed): next token to be sold
        // tokensSold is in token units with 18 decimals, so we divide by 1e18 to get token count
        uint256 tokenNumber = (tokensSold / 1e18) + 1;

        // Price formula: y = a * x + b
        // Using FullMath for safe multiplication
        price = FullMath.mulDiv(slope, tokenNumber, 1) + startingPrice;
    }

    /**
     * @dev Calculate the total cost for purchasing a specific amount of tokens
     * @param _amount Amount of tokens to purchase (in token units with 18 decimals)
     * @return totalCost Total cost in wei
     * @notice Uses arithmetic progression sum: sum from i=1 to N of [a*(S+i) + b]
     *         where S = tokensSold/1e18, N = _amount/1e18
     *         Formula: N * (a * (S + (N+1)/2) + b)
     */
    function calculatePurchaseCost(
        uint256 _amount
    ) public view returns (uint256 totalCost) {
        require(_amount > 0, "Amount must be > 0");
        require(
            tokensSold + _amount <= tokensForSale,
            "Not enough tokens available"
        );

        // Convert token amounts to token counts (divide by 1e18)
        uint256 tokensSoldCount = tokensSold / 1e18;
        uint256 amountCount = _amount / 1e18;

        // Calculate sum using arithmetic progression formula
        // Sum = N * (a * (S + (N+1)/2) + b)
        // Where:
        // - N = amountCount (number of tokens to buy)
        // - S = tokensSoldCount (number of tokens already sold)
        // - a = slope (wei per token)
        // - b = startingPrice (wei per token)

        // Calculate: (N+1)/2
        uint256 nPlusOneOverTwo = FullMath.mulDiv(amountCount + 1, 1, 2);

        // Calculate: S + (N+1)/2 (average token number)
        uint256 averageTokenNumber = tokensSoldCount + nPlusOneOverTwo;

        // Calculate: a * (S + (N+1)/2) using FullMath for safe multiplication
        uint256 slopeTimesAverage = FullMath.mulDiv(
            slope,
            averageTokenNumber,
            1
        );

        // Calculate: a * (S + (N+1)/2) + b (average price per token)
        uint256 averagePrice = slopeTimesAverage + startingPrice;

        // Calculate: N * averagePrice (total cost in wei)
        // amountCount is the number of tokens, averagePrice is in wei per token
        totalCost = FullMath.mulDiv(amountCount, averagePrice, 1);
    }

    /**
     * @dev Buy tokens with ETH. Price increases progressively as more tokens are sold.
     * @param _amount Amount of tokens to purchase
     */
    function buy(uint256 _amount) external payable nonReentrant {
        // Check sale is active
        require(block.timestamp >= saleStartTime, "Sale has not started");
        require(block.timestamp <= saleEndTime, "Sale has ended");

        // Check sufficient tokens available
        require(_amount > 0, "Amount must be > 0");
        require(
            tokensSold + _amount <= tokensForSale,
            "Not enough tokens available"
        );

        // Calculate total cost
        uint256 totalCost = calculatePurchaseCost(_amount);

        // Check sufficient ETH sent
        require(msg.value >= totalCost, "Insufficient ETH sent");

        // Update state
        tokensSold += _amount;

        // Transfer tokens to buyer
        _transfer(owner(), msg.sender, _amount);

        // Send ETH to treasury
        if (treasury != address(0)) {
            (bool success, ) = payable(treasury).call{value: totalCost}("");
            require(success, "ETH transfer failed");
        }

        // Refund excess ETH
        if (msg.value > totalCost) {
            (bool refundSuccess, ) = payable(msg.sender).call{
                value: msg.value - totalCost
            }("");
            require(refundSuccess, "ETH refund failed");
        }

        emit TokensPurchased(msg.sender, _amount, totalCost, getCurrentPrice());
    }

    /**
     * @dev Set the treasury address that receives ETH from purchases
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury cannot be zero address");
        treasury = _treasury;
    }

    /**
     * @dev Get sale information
     */
    function getSaleInfo()
        external
        view
        returns (
            uint256 _saleStartTime,
            uint256 _saleEndTime,
            uint256 _tokensForSale,
            uint256 _tokensSold,
            uint256 _tokensRemaining,
            uint256 _currentPrice,
            bool _isActive
        )
    {
        _saleStartTime = saleStartTime;
        _saleEndTime = saleEndTime;
        _tokensForSale = tokensForSale;
        _tokensSold = tokensSold;
        _tokensRemaining = tokensForSale - tokensSold;
        _currentPrice = getCurrentPrice();
        _isActive =
            block.timestamp >= saleStartTime &&
            block.timestamp <= saleEndTime &&
            tokensSold < tokensForSale;
    }
}
