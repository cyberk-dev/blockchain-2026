pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant PRECISION = 1e22;
    uint256 public a;
    uint256 public b;
    uint256 public endTime;
    uint256 public buyFeePercent;
    address public feeRecipient;
    IERC20 public paymentToken;

    event TokenBought(address indexed buyer, uint256 amount, uint256 cost);
    event TokensPurchased(
        address indexed buyer,
        uint256 tokenAmount,
        uint256 totalCost,
        uint256 feeAmount,
        uint256 netAmount
    );

    error InvalidAmount();
    error SaleEnded();
    error InvalidFeeRecipient();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _a,
        uint256 _b,
        address _paymentToken,
        uint256 _duration,
        uint256 _buyFeePercent,
        address _feeRecipient
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        a = _a;
        b = _b;
        endTime = block.timestamp + _duration;
        paymentToken = IERC20(_paymentToken);
        buyFeePercent = _buyFeePercent;
        feeRecipient = _feeRecipient;
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

    function buyToken(uint256 _amount) external nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        if (block.timestamp > endTime) revert SaleEnded();

        uint256 totalCost = getCost(totalSupply(), _amount, a, b);
        uint256 feeAmount = (totalCost * buyFeePercent) / 100;
        uint256 netAmount = totalCost - feeAmount;

        paymentToken.safeTransferFrom(msg.sender, address(this), netAmount);
        if (feeAmount > 0) {
            paymentToken.safeTransferFrom(msg.sender, feeRecipient, feeAmount);
        }

        _mint(msg.sender, _amount);

        emit TokenBought(msg.sender, _amount, totalCost);
        emit TokensPurchased(msg.sender, _amount, totalCost, feeAmount, netAmount);
    }

    function setEndTime(uint256 _endTime) external onlyOwner {
        endTime = _endTime;
    }

    function setBuyFeePercent(uint256 _newPercent) external onlyOwner {
        buyFeePercent = _newPercent;
    }

    function withdraw(address _to) external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransfer(_to, balance);
    }
}
