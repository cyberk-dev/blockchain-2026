// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "hardhat/console.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    using SafeERC20 for IERC20;
    uint256 endTime;
    uint256 public totalWeiSold;
    uint256 public a;
    uint256 public b;
    uint256 public scale;
    address public paymentToken;
    address public feeRecipient;
    uint256 public constant BUY_FEE_BPS = 10; // 0.1%

    constructor(
        string memory _name,
        string memory _symbol,
        address _paymentToken,
        uint256 _initialSupply,
        uint256 _endTime,
        uint256 _a,
        uint256 _b,
        uint256 _scale,
        address _feeRecipient
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        a = _a;
        b = _b;
        paymentToken = _paymentToken;
        scale = _scale;
        _mint(msg.sender, _initialSupply);

        endTime = _endTime;
        totalWeiSold = _initialSupply;
        feeRecipient = _feeRecipient;
    }

    error InsufficientFunds();
    error InvalidAmount();
    error SaleEnded();

    event TokenBought(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 fee,
        uint256 totalPayment
    );

    function getCost(uint256 s, uint256 m) public view returns (uint256) {
        uint256 part1 = a * (m * s);
        uint256 part2 = a * ((m * (m + 1)) / 2);
        uint256 part3 = b * m;

        uint256 sum = part1 + part2 + part3;
        uint256 result = sum.mulDiv(1, scale);
        return result;
    }

    modifier saleActive() {
        if (block.timestamp > endTime) revert SaleEnded();
        _;
    }

    function buyToken(
        uint256 _amount
    ) external payable saleActive nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        uint256 cost = getCost(totalWeiSold, _amount);
        uint256 fee = (cost * BUY_FEE_BPS) / 10_000; // 10 bps = 0.1%

        uint256 totalPayment = cost + fee;

        IERC20(paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            totalPayment
        );

        _mint(msg.sender, _amount);
        totalWeiSold += _amount;

        emit TokenBought(msg.sender, _amount, cost, fee, totalPayment);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
