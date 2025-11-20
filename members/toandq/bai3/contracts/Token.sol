// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";
import {SimpleBondingCurve} from "./curves/SimpleBondingCurve.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public endTime;
    uint256 public slope;
    uint256 public intercept;
    uint256 public slopePower = 26;

    error InsufficientFunds();
    error InvalidAmount();
    error EndTimeReached();

    modifier notEnded() {
        if (block.timestamp >= endTime) revert EndTimeReached();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        uint256 _endTime
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        endTime = _endTime;
        slope = 134 * 10 ** (slopePower - 5);
        intercept = 1e12;
        _mint(msg.sender, _initialSupply);
    }

    function setSlopeAndIntercept(
        uint256 _slope,
        uint256 _intercept
    ) external onlyOwner {
        slope = _slope;
        intercept = _intercept;
    }

    function buyToken(uint256 _amount) external payable nonReentrant notEnded {
        if (_amount == 0) revert InvalidAmount();
        uint256 price = getBuyPrice(_amount);

        if (msg.value < price) revert InsufficientFunds();

        _mint(msg.sender, _amount);
    }

    function getBuyPrice(uint256 amount) public view returns (uint256) {
        return
            SimpleBondingCurve.calculatePrice(
                totalSupply(),
                amount,
                slope,
                intercept,
                decimals(),
                slopePower
            );
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
