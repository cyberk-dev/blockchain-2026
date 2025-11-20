// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public price; // per 1_0000000000000000 (decimals) - kept for backward compatibility
    uint256 public endTime; // Timestamp when token sale ends
    uint256 public slope; // 'a' in formula y = ax + b (price increase rate)
    uint256 public basePrice; // 'b' in formula y = ax + b (starting price)
    uint256 public totalSold; // Total number of tokens sold (in wei units, with decimals)

    error InsufficientFunds();
    error InvalidAmount();
    error SaleEnded();

    // Modifier to check if the sale period has not ended
    modifier beforeEndTime() {
        if (block.timestamp > endTime) revert SaleEnded();
        _;
    }

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
      ERC20(_name, _symbol) 
      Ownable(msg.sender)
    {
        // Set endTime to 1 hour after deployment
        endTime = block.timestamp + 1 hours;
        
        // Initialize pricing parameters
        // basePrice (b) = 0.1 ether per token (in wei per 10^18 tokens)
        basePrice = 0.1 ether; 
        
        // slope (a) = 0 by default (no price increase)
        // Owner can set this later using setPricingParameters()
        // Example: slope = 0.00001 ether means price increases by 0.00001 ETH per token sold
        slope = 0;
        
        // Keep old price variable for backward compatibility
        price = basePrice;
        
        // Initialize totalSold to 0
        totalSold = 0;
        
        _mint(msg.sender, _initialSupply);
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
        basePrice = _price; // Update basePrice as well
    }

    function setPricingParameters(uint256 _slope, uint256 _basePrice) external onlyOwner {
        slope = _slope;
        basePrice = _basePrice;
        price = _basePrice; // Update price for backward compatibility
    }

    function setEndTime(uint256 _endTime) external onlyOwner {
        endTime = _endTime;
    }

    /**
     * @notice Calculate the total cost to buy N tokens with progressive pricing
     * @dev Uses arithmetic progression formula from WolframAlpha:
     *      Sum[a*x + b, {x, S+1, S+N}] = (N * (2*a*S + a*(N+1) + 2*b)) / 2
     * @param _amount Number of tokens to buy (in wei units with decimals)
     * @return Total cost in wei
     */
    function calculateCost(uint256 _amount) public view returns (uint256) {
        if (_amount == 0) return 0;
        
        // S = totalSold (current number of tokens sold)
        // N = _amount (number of tokens to buy)
        // a = slope
        // b = basePrice
        
        // Convert to token units (divide by 10^decimals) for calculation
        uint256 S = totalSold / (10**decimals());
        uint256 N = _amount / (10**decimals());
        
        // Formula: Sum = (N * (2*a*S + a*(N+1) + 2*b)) / 2
        
        // Calculate: 2*a*S
        uint256 twoAS = 2 * slope * S;
        
        // Calculate: a*(N+1)
        uint256 aNPlus1 = slope * (N + 1);
        
        // Calculate: 2*b
        uint256 twoB = 2 * basePrice;
        
        // Calculate: 2*a*S + a*(N+1) + 2*b
        uint256 innerSum = twoAS + aNPlus1 + twoB;
        
        // Calculate: N * (2*a*S + a*(N+1) + 2*b)
        uint256 totalBeforeDiv = N * innerSum;
        
        // Divide by 2 to get final result
        uint256 totalCost = totalBeforeDiv / 2;
        
        return totalCost;
    }

    function buyToken(uint256 _amount) external payable nonReentrant beforeEndTime {
        if (_amount == 0) revert InvalidAmount();
        
        // Calculate the total cost for buying _amount tokens with progressive pricing
        uint256 totalCost = calculateCost(_amount);
        
        // Check if the sent value is sufficient
        if (msg.value < totalCost) revert InsufficientFunds();
        
        // Update totalSold before minting
        totalSold += _amount;
        
        // Mint tokens to buyer
        _mint(msg.sender, _amount);
        
        // Refund excess payment if any
        if (msg.value > totalCost) {
            (bool success, ) = msg.sender.call{value: msg.value - totalCost}("");
            require(success, "Refund failed");
        }
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}