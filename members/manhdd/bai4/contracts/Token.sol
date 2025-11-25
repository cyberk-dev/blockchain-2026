pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    uint256 public constant PRECISION = 1e22;
    uint256 public a;
    uint256 public b;
    uint256 public endTime;
    IERC20 public paymentToken;

    event TokenBought(address indexed buyer, uint256 amount, uint256 cost);

    error InsufficientFunds();
    error InvalidAmount();
    error SaleEnded();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _a,
        uint256 _b,
        address _paymentToken,
        uint256 _duration
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        a = _a;
        b = _b;
        endTime = block.timestamp + _duration;
        paymentToken = IERC20(_paymentToken);
    }

    function getCost(
        uint256 s,
        uint256 m,
        uint256 _a,
        uint256 _b
    ) public pure returns (uint256) {
        return
            FullMath.mulDiv(_a * m, 2 * s + m + 1, 2 * PRECISION) +
            FullMath.mulDiv(_b, m, PRECISION);
    }

    function buyToken(uint256 _amount) external payable nonReentrant {
        if(_amount == 0) revert InvalidAmount();
        if(block.timestamp > endTime) revert SaleEnded();

        uint256 cost = getCost(totalSupply(), _amount, a, b);
        paymentToken.transferFrom(
            msg.sender,
            address(this),
            cost
        );
        _mint(msg.sender, _amount);

        emit TokenBought(msg.sender, _amount, cost);
    }

    function setEndTime(uint256 _endTime) external onlyOwner {
        endTime = _endTime;
    }

    function withdraw(address _to) external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        paymentToken.transfer(_to, balance);
    }
}
