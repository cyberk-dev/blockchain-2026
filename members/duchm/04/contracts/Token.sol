pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FullMath.sol";
import "./PaymentToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public basePrice;
    uint256 public slope;
    uint256 public endTime;
    uint256 public tokenSold;
    IERC20 public paymentToken;

    event TokenBought(address buyer, uint256 amount, uint256 cost);
    event PriceUpdated(uint256 newPrice);

    error InvalidAmount();
    error PurchasePeriodEnded();

    modifier onlyBeforeEndTime() {
        if (block.timestamp > endTime) revert PurchasePeriodEnded();
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        IERC20 _paymentTokenAddress,
        uint256 _slope,
        uint256 _basePrice
    ) ERC20(name, symbol) Ownable(msg.sender) {
        tokenSold = 0;
        slope = _slope;
        basePrice = _basePrice;
        endTime = block.timestamp + 1 hours;
        paymentToken = IERC20(_paymentTokenAddress);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setPrice(uint256 _price) public onlyOwner {
        basePrice = _price;
        emit PriceUpdated(_price);
    }

    function getCost(
        uint256 s, // tokens already sold
        uint256 m, // amount to buy
        uint256 a, // slope
        uint256 b // base price
    ) public pure returns (uint256) {
        if (m == 0) return 0;
        return m.mulDiv(2 * s + m - 1 + 2 * b, 2 * a);
    }

    function buy(uint256 amount) public onlyBeforeEndTime nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 totalCost = getCost(tokenSold, amount, slope, basePrice);

        paymentToken.transferFrom(msg.sender, address(this), totalCost);

        tokenSold += amount;
        _mint(msg.sender, amount);
        emit TokenBought(msg.sender, amount, totalCost);
    }

    function unit() public view returns (uint256) {
        return 10 ** decimals();
    }
}
