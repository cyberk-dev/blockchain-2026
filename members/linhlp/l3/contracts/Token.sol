pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 startingPrice;
    uint256 slope;
    uint256 tokenSold;
    uint256 endTime;

    error InsufficientFunds();
    error InvalidAmount();
    error SaleEnded();

    event BondingCurveContributed(address indexed contributor, uint256 amount, uint256 cost);

    modifier notSaleEnded() {
        if (block.timestamp >= endTime) revert SaleEnded();
        _;
    }

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
      ERC20(_name, _symbol) 
      Ownable(msg.sender)
    {
        startingPrice = 0.1 ether; // 1 * 10^17
        slope = 0.000001 ether;
        tokenSold = 0;
        endTime = block.timestamp + 1 days;
        _mint(msg.sender, _initialSupply);
    }

    function buyToken(uint256 _amount) external payable nonReentrant notSaleEnded {
        if (_amount == 0) revert InvalidAmount();
        uint256 cost = getCost(_amount);
        if (msg.value < cost) revert InsufficientFunds();
        _mint(msg.sender, _amount);
        tokenSold += _amount;
        emit BondingCurveContributed(msg.sender, _amount, cost);
    }

    function getCost(uint256 _amount) public view returns (uint256) {
        uint256 term = 2 * tokenSold + _amount + 1;
        uint256 n_times_term = _amount.mulDivRoundingUp(term, 1);
        uint256 cost = slope.mulDivRoundingUp(n_times_term, 2) + startingPrice * _amount;
        return cost;
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }


    function getTokenSold() external view returns (uint256) {
        return tokenSold;
    }
}