pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 basePrice;
    uint256 slope;
    uint256 endTime;
    uint256 tokenSold;

    event TokenBought(address buyer, uint256 amount, uint256 cost);
    event PriceUpdated(uint256 newPrice);

    error InsufficientFunds();
    error InvalidAmount();
    error PurchasePeriodEnded();

    modifier onlyBeforeEndTime() {
        if (block.timestamp > endTime) revert PurchasePeriodEnded();
        _;
    }

    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) Ownable(msg.sender) {
        tokenSold = 0;
        slope = 0.0001 ether;
        basePrice = 0.1 ether;
        endTime = block.timestamp + 1 hours;
        _mint(msg.sender, 1000000 * unit());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function setPrice(uint256 _price) public onlyOwner {
        basePrice = _price;
        emit PriceUpdated(_price);
    }

    function calculateCost(uint256 n) internal view returns (uint256) {
        uint256 s = tokenSold;
        uint256 b = basePrice;
        uint256 a = slope;
        uint256 term = 2 * s + n + 1;
        uint256 n_times_term = n.mulDivRoundingUp(term, 1);
        return a.mulDivRoundingUp(n_times_term, 2) + b * n;
    }

    function buy(uint256 amount) public payable onlyBeforeEndTime nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 totalCost = calculateCost(amount);
        if (msg.value < totalCost) revert InsufficientFunds();

        uint256 refundAmount = msg.value - totalCost;
        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
        }

        tokenSold += amount;
        _mint(msg.sender, amount * unit());
        emit TokenBought(msg.sender, amount, totalCost);
    }

    function unit() public view returns (uint256) {
        return 10 ** decimals();
    }

    function getTokenSold() external view returns (uint256) {
        return tokenSold;
    }
}
