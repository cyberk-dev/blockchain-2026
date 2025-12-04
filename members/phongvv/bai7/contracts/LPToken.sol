// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FullMath} from "./libraries/FullMath.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";

contract LPToken is ERC20 {
    using FullMath for uint256;
    using SafeERC20 for ERC20;
    using SafeERC20 for IERC20;

    uint256 constant DENOMINATOR = 10000;
    uint256 constant FEE = 30; //0.3%

    IERC20 public token1;
    IERC20 public token2;

    uint256 private reserve1;
    uint256 private reserve2;

    event Swap(
        address indexed sender,
        uint256 amount1In,
        uint256 amount2In,
        uint256 amount1Out,
        uint256 amount2Out
    );

    error InsufficientLiquidity();
    error InsufficientToken1Amount();
    error InsufficientToken2Amount();
    error InsufficientOutputAmount();
    error ExcessiveInputAmount();
    error InvalidInput();

    constructor(
        string memory name_,
        string memory symbol_,
        address token1_,
        address token2_
    ) ERC20(name_, symbol_) {
        token1 = IERC20(token1_);
        token2 = IERC20(token2_);
    }

    function addLiquidity(
        uint256 amount1Desired_,
        uint256 amount2Desired_,
        uint256 amount1Min_,
        uint256 amount2Min_
    )
        external
        returns (uint256 _amount1, uint256 _amount2, uint256 _liquidity)
    {
        (_amount1, _amount2) = _addLiquidity(
            amount1Desired_,
            amount2Desired_,
            amount1Min_,
            amount2Min_
        );
        token1.safeTransferFrom(msg.sender, address(this), _amount1);
        token2.safeTransferFrom(msg.sender, address(this), _amount2);

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            _liquidity = Math.max(_amount1, _amount2);
            _mint(msg.sender, _liquidity);
        } else {
            _liquidity = Math.min(
                _amount1.mulDiv(_totalSupply, reserve1),
                _amount2.mulDiv(_totalSupply, reserve2)
            );
            _mint(msg.sender, _liquidity);
        }
        reserve1 += _amount1;
        reserve2 += _amount2;
    }

    function removeLiquidity(
        uint256 liquidity_,
        uint256 amount1Min_,
        uint256 amount2Min_,
        address to_
    ) external returns (uint256 _amount1, uint256 _amount2) {
        _amount1 = liquidity_.mulDiv(reserve1, totalSupply());
        _amount2 = liquidity_.mulDiv(reserve2, totalSupply());
        if (_amount1 < amount1Min_) revert InsufficientToken1Amount();
        if (_amount2 < amount2Min_) revert InsufficientToken2Amount();
        _burn(msg.sender, liquidity_);
        token1.safeTransfer(to_, _amount1);
        token2.safeTransfer(to_, _amount2);
        reserve1 -= _amount1;
        reserve2 -= _amount2;
    }

    function swap1To2ExactAmountIn(
        uint256 amountIn_,
        uint256 amountOutMin_
    ) external returns (uint256 amountIn, uint256 amountOut, uint256 fee) {
        uint256 amountOutTotal = amountIn_.mulDiv(
            reserve2,
            (reserve1 + amountIn)
        );
        amountIn = amountIn_;
        amountOut = amountOutTotal.mulDiv(DENOMINATOR - FEE, DENOMINATOR);
        console.log("====amountOutTotal", amountOutTotal);
        console.log("====amountOut", amountOut);
        fee = amountOutTotal - amountOut;
        if (amountOut < amountOutMin_) revert InsufficientOutputAmount();
        token1.safeTransferFrom(msg.sender, address(this), amountIn_);
        token2.safeTransfer(msg.sender, amountOut);
        reserve1 += amountIn_;
        reserve2 -= amountOut;
        emit Swap(msg.sender, amountIn_, 0, 0, amountOut);
    }

    function swap1To2ExactAmountOut(
        uint256 amountOut_,
        uint256 amountInMax_
    ) external returns (uint256 amountIn, uint256 amountOut, uint256 fee) {
        uint256 amountInTotal = amountOut_.mulDiv(
            reserve1,
            (reserve2 + amountOut)
        );
        amountIn = amountInTotal.mulDiv(DENOMINATOR, DENOMINATOR - FEE);
        amountOut = amountOut_;
        fee = amountIn - amountInTotal;
        if (amountIn > amountInMax_) revert ExcessiveInputAmount();
        token1.safeTransferFrom(msg.sender, address(this), amountIn);
        token2.safeTransfer(msg.sender, amountOut);
        reserve1 += amountIn;
        reserve2 -= amountOut;
        emit Swap(msg.sender, amountIn, 0, 0, amountOut);
    }

    function _addLiquidity(
        uint256 amount1Desired_,
        uint256 amount2Desired_,
        uint256 amount1Min_,
        uint256 amount2Min_
    ) internal view returns (uint256 _amount1, uint256 _amount2) {
        if (reserve1 == 0 && reserve2 == 0) {
            (_amount1, _amount2) = (amount1Desired_, amount2Desired_);
        } else {
            uint256 amount2Optimal = _quote(
                amount1Desired_,
                reserve1,
                reserve2
            );
            if (amount2Optimal <= amount2Desired_) {
                if (amount2Optimal < amount2Min_)
                    revert InsufficientToken2Amount();
                (_amount1, _amount2) = (amount1Desired_, amount2Optimal);
            } else {
                uint256 amount1Optimal = _quote(
                    amount2Desired_,
                    reserve2,
                    reserve1
                );
                if (amount1Optimal < amount1Min_)
                    revert InsufficientToken1Amount();
                (_amount1, _amount2) = (amount1Optimal, amount2Desired_);
            }
        }
    }

    function _quote(
        uint256 amountA_,
        uint256 reserveA_,
        uint256 reserveB_
    ) internal pure returns (uint256 _amountB) {
        if (amountA_ == 0) revert InvalidInput();
        if (reserveA_ == 0 || reserveB_ == 0) revert InsufficientLiquidity();
        _amountB = amountA_.mulDiv(reserveB_, reserveA_);
    }
}
