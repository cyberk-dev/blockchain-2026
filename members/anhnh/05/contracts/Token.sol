// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FullMath} from "./FullMath.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Token is ERC20, ReentrancyGuard {
    using FullMath for uint256;
    uint256 public a;
    uint256 public b;
    uint256 public tokenSold;
    IERC20 public paymentToken;
    
    // Fee configuration
    address public feeRecipient;
    uint256 public buyFeeBps; // basis points, 100 = 1%, 10000 = 100%
    uint256 public constant BPS_DENOMINATOR = 10000;

    event TokenBought(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 fee
    );
    
    error InvalidAmount();
    error InsufficientFunds();
    
    uint256 public constant DECIMALS = 18;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        uint256 slope,
        uint256 basePrice,
        address paymentTokenAddress,
        address _feeRecipient,
        uint256 _buyFeeBps
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
        a = slope;
        tokenSold = 0;
        b = basePrice;
        paymentToken = IERC20(paymentTokenAddress);
        feeRecipient = _feeRecipient;
        buyFeeBps = _buyFeeBps;
    }

    function getPrice(uint256 supply) public view returns (uint256) {
        // Use FullMath.mulDiv to safely compute _slope * supply / (10 ** DECIMALS) + _basePrice for proper scaling and no overflow
        return a.mulDiv(supply, 10 ** DECIMALS) + b;
    }

    function getCost(
        uint256 s, // tokens already sold
        uint256 m // amount to buy
    ) public view returns (uint256) {
        if (m == 0) return 0;
        return m.mulDiv(2 * s + m - 1 + 2 * b, 2 * a);
    }

    function buyToken(uint256 _amount) external nonReentrant {
        if (_amount == 0) revert InvalidAmount();

        uint256 cost = getCost(tokenSold, _amount);
        
        // Calculate fee
        uint256 fee = cost.mulDiv(buyFeeBps, BPS_DENOMINATOR);

        // Transfer payment to contract
        paymentToken.transferFrom(msg.sender, address(this), cost);
        
        // Transfer fee to recipient
        if (fee > 0 && feeRecipient != address(0)) {
            paymentToken.transferFrom(msg.sender, feeRecipient, fee);
        }

        tokenSold += _amount;
        _mint(msg.sender, _amount);
        emit TokenBought(msg.sender, _amount, cost, fee);
    }
}
