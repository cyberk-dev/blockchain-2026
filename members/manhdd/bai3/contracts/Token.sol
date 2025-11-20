pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    uint256 public a;
    uint256 public b;

    uint256 public endTime;

    uint256 public tokensSold;

    error InsufficientFunds();
    error InvalidAmount();

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
        ERC20(_name, _symbol) 
        Ownable(msg.sender)
    {
        b = 0.1 ether;
        a = 0;

        endTime = block.timestamp + 1 hours;

        _mint(msg.sender, _initialSupply);
    }

    function setPrice(uint256 _price) external onlyOwner {
        b = _price;
    }

    function setPricing(uint256 _a, uint256 _b) external onlyOwner {
        a = _a;
        b = _b;
    }

    modifier beforeEnd() {
        require(block.timestamp <= endTime, "Sale ended");
        _;
    }

    function buyToken(uint256 _amount) external payable nonReentrant beforeEnd {
        if (_amount == 0) revert InvalidAmount();

        uint256 unit = 10**decimals();
        require(_amount % unit == 0, "Amount must be multiple of 1 token");

        uint256 N = _amount / unit;

        uint256 S = tokensSold;

        uint256 SN = S + N;

        uint256 sum1 = FullMath.mulDiv(SN, SN + 1, 2);
        uint256 sum2 = FullMath.mulDiv(S, S + 1, 2);
        uint256 sumK = sum1 - sum2;

        uint256 costA = 0;
        if (a != 0 && sumK != 0) {
            costA = FullMath.mulDiv(a, sumK, 1);
        }
        uint256 costB = 0;
        if (b != 0 && N != 0) {
            costB = FullMath.mulDiv(b, N, 1);
        }

        uint256 totalCost = costA + costB;

        require(msg.value >= totalCost, "Insufficient payment");

        _mint(msg.sender, _amount);

        tokensSold = S + N;

        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            if (!ok) {
            }
        }
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}