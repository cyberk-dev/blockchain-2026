// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {
    IERC20Metadata
} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./libraries/FullMath.sol";

contract TokenLinear is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;
    using FullMath for uint256;

    uint256 public slope;
    uint256 public intercept;
    IERC20Metadata public fee;

    event TokenBought(uint256 amount, uint256 cost);

    error InvalidAmount();
    error InvalidParams();

    constructor(
        string memory _name,
        string memory _symbol,
        address _fee,
        uint256 _slope,
        uint256 _intercept
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        fee = IERC20Metadata(_fee);
        slope = _slope;
        intercept = _intercept;
    }

    function setParameters(
        uint256 _slope,
        uint256 _intercept
    ) external onlyOwner {
        if (_slope == 0 || _intercept == 0) revert InvalidParams();
        slope = _slope;
        intercept = _intercept;
    }

    function setFeeToken(address _token) external onlyOwner {
        fee = IERC20Metadata(_token);
    }

    //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2Ca%5D+%2B+Divide%5B12%2Cb%5D%2C%7Bx%2Cs%2B1%2Cs%2Bm%7D%5D
    function getCost(
        uint256 _supply,
        uint256 _amount,
        uint256 _slope,
        uint256 _intercept
    ) public pure returns (uint256) {
        if (_slope == 0 || _intercept == 0) revert InvalidParams();
        return
            _amount.mulDiv(_amount + 2 * _supply + 1, 2 * _slope) +
            _amount.mulDiv(12, _intercept);
    }

    function buyTokens(uint256 _amount) external nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        uint256 cost = getCost(totalSupply(), _amount, slope, intercept);
        uint256 feeCost = cost.mulDivRoundingUp(10 ** fee.decimals(), 10 ** 18);
        fee.safeTransferFrom(msg.sender, address(this), feeCost);
        _mint(msg.sender, _amount);
        emit TokenBought(_amount, feeCost);
    }
}
