// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";
import {SimpleBondingCurve} from "./curves/SimpleBondingCurve.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public usdt;

    uint256 public endTime;
    uint256 public slope;
    uint256 public intercept;

    error InsufficientFunds();
    error InvalidAmount();
    error EndTimeReached();

    modifier notEnded() {
        if (block.timestamp >= endTime) revert EndTimeReached();
        _;
    }

    constructor(
        address _usdt
    ) ERC20("Liquidity Token", "LTK") Ownable(msg.sender) {
        usdt = IERC20(_usdt);
    }

    function setSlopeAndIntercept(
        uint256 _slope,
        uint256 _intercept
    ) external onlyOwner {
        slope = _slope;
        intercept = _intercept;
    }

    function buyToken(uint256 _amount) external nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        uint256 price = getBuyPrice(_amount);

        usdt.safeTransferFrom(msg.sender, address(this), price);

        _mint(msg.sender, _amount);
    }

    function getBuyPrice(uint256 amount) public view returns (uint256) {
        return
            SimpleBondingCurve.calculatePrice(
                totalSupply(),
                amount,
                slope,
                intercept
            );
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
