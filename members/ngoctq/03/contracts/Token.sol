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
    uint256 public initialSupply; // Initial supply minted to owner (to calculate tokens sold)

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
        
        // Store initial supply to calculate tokens sold later
        initialSupply = _initialSupply;
        
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
     * @notice Calculate the total cost to buy m tokens with progressive pricing
     * @dev Uses arithmetic progression formula from WolframAlpha:
     *      Sum[a*x + b, {x, s+1, s+m}] = (1/2) * a * m * (m + 2*s + 1) + b * m
     *      
     *      Where:
     *      - m = number of tokens to buy (in token units)
     *      - s = tokens already sold (in token units) = totalSupply - initialSupply
     *      - a = slope (price increase per token, in wei)
     *      - b = basePrice (starting price per token, in wei)
     *      
     *      Since _amount and totalSupply are in wei, we convert:
     *      - m = _amount / 10^18
     *      - s = (totalSupply() - initialSupply) / 10^18
     *      
     *      To avoid precision loss, we use FullMath.mulDiv for division operations.
     *      
     * @param _amount Number of tokens to buy (in wei units with decimals)
     * @return Total cost in wei
     */
    function calculateCost(uint256 _amount) public view returns (uint256) {
        if (_amount == 0) return 0;
        
        uint256 DECIMALS = 10**decimals();
        
        // Formula: Sum = (1/2) * a * m * (m + 2*s + 1) + b * m
        // Rearranged: Sum = m * [(1/2) * a * (m + 2*s + 1) + b]
        //                 = (_amount / DECIMALS) * [(1/2) * a * (_amount/DECIMALS + 2*s/DECIMALS + 1) + b]
        
        // Calculate tokens already sold: s = totalSupply() - initialSupply
        uint256 tokensSold = totalSupply() - initialSupply;
        
        // Calculate: m + 2*s + 1 = _amount/DECIMALS + 2*tokensSold/DECIMALS + 1
        // To avoid precision loss: (m + 2*s + 1) * DECIMALS = _amount + 2*tokensSold + DECIMALS
        uint256 mPlus2sPlus1TimesDecimals = _amount + 2 * tokensSold + DECIMALS;
        
        // Calculate: (1/2) * a * (m + 2*s + 1) = a * (m + 2*s + 1) / 2
        //          = a * mPlus2sPlus1TimesDecimals / (2 * DECIMALS)
        uint256 slopeTerm = slope.mulDiv(mPlus2sPlus1TimesDecimals, 2 * DECIMALS);
        
        // Calculate: (1/2) * a * (m + 2*s + 1) + b
        uint256 pricePerToken = slopeTerm + basePrice;
        
        // Calculate: m * pricePerToken = (_amount / DECIMALS) * pricePerToken
        uint256 totalCost = _amount.mulDiv(pricePerToken, DECIMALS);
        
        return totalCost;
    }

    function buyToken(uint256 _amount) external payable nonReentrant beforeEndTime {
        if (_amount == 0) revert InvalidAmount();
        
        // Calculate the total cost for buying _amount tokens with progressive pricing
        uint256 totalCost = calculateCost(_amount);
        
        // Check if the sent value is sufficient
        if (msg.value < totalCost) revert InsufficientFunds();
        
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