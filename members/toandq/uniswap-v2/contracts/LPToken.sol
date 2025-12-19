// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LPToken is ERC20, Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    address public token0;
    address public token1;

    uint256 reserve0;
    uint256 reserve1;
    uint256 kLast;

    event LiquidityAdded(
        address indexed to,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

    event LiquidityRemoved(
        address indexed to,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

    error InsufficientLiquidity();
    error InsufficientLiquidityBurned();
    error InsufficientAmountOut();
    error InvalidAmount();
    error SlippageExceeded();

    constructor(
        address _token0,
        address _token1
    ) ERC20("LPToken", "LP") Ownable(msg.sender) {
        token0 = _token0;
        token1 = _token1;
    }

    function mintLiquidity(
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant {
        if (amount0 == 0 || amount1 == 0) revert InvalidAmount();

        uint256 _totalSupply = totalSupply();

        uint256 liquidity;

        uint256 in0;
        uint256 in1;

        // First mint
        if (_totalSupply == 0) {
            liquidity = Math.min(amount0, amount1);
            in0 = amount0;
            in1 = amount1;
        } else {
            in1 = amount0.mulDiv(reserve1, reserve0);
            in0 = amount0;
            if (in1 > amount1) {
                in1 = amount1;
                in0 = amount1.mulDiv(reserve0, reserve1);
            }
            liquidity = Math.min(
                amount0.mulDiv(_totalSupply, in0),
                amount1.mulDiv(_totalSupply, in1)
            );
        }

        if (liquidity == 0) revert InsufficientLiquidity();

        IERC20(token0).safeTransferFrom(msg.sender, address(this), in0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), in1);

        _mint(msg.sender, liquidity);

        unchecked {
            reserve0 += in0;
            reserve1 += in1;
            kLast = in0 * in1;
        }

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    function burnLiquidity(
        uint256 liquidity
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        uint _totalSupply = totalSupply();

        if (liquidity > _totalSupply) {
            revert InsufficientLiquidityBurned();
        }

        amount0 = liquidity.mulDiv(reserve0, _totalSupply);
        amount1 = liquidity.mulDiv(reserve1, _totalSupply);

        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();

        _burn(msg.sender, liquidity);
        IERC20(token0).safeTransfer(msg.sender, amount0);
        IERC20(token1).safeTransfer(msg.sender, amount1);

        unchecked {
            reserve0 -= amount0;
            reserve1 -= amount1;
            kLast = reserve0 * reserve1;
        }

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }

    function swapExactOut(
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMax
    ) external nonReentrant returns (uint256 amountIn) {
        (uint256 reserveIn, uint256 reserveOut, address tokenIn) = tokenOut ==
            token0
            ? (reserve0, reserve1, token1)
            : (reserve1, reserve0, token0);

        amountIn = _getAmountIn(amountOut, reserveIn, reserveOut);
        if (amountIn > amountInMax) {
            revert SlippageExceeded();
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        unchecked {
            reserveIn += amountIn;
            reserveOut -= amountOut;
            kLast = reserveIn * reserveOut;
        }
    }

    function swapExactIn(
        address tokenIn,
        uint256 amountOutMin,
        uint256 amountIn
    ) external onlyOwner returns (uint256 amountOut) {
        (uint256 reserveIn, uint256 reserveOut, address tokenOut) = tokenIn ==
            token0
            ? (reserve0, reserve1, token1)
            : (reserve1, reserve0, token0);

        amountOut = _getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientAmountOut();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        unchecked {
            reserve0 += amountIn;
            reserve1 -= amountOut;
            kLast = reserve0 * reserve1;
        }
    }

    function getAmountIn(
        address tokenOut,
        uint256 amountOutMin
    ) external view returns (uint256 amountIn) {
        (uint256 reserveIn, uint256 reserveOut) = tokenOut == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        amountIn = _getAmountIn(amountOutMin, reserveIn, reserveOut);
    }

    function getAmountOut(
        address tokenIn,
        uint256 amountInMax
    ) external view returns (uint256 amountOut) {
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        amountOut = _getAmountOut(amountInMax, reserveIn, reserveOut);
    }

    function _getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        // deltaX=deltaY*reserveIn/(reserveOut-deltaY)
        // amountIn=amountOut*reserveIn/(reserveOut-amountOut)
        // Fee is 0.3%
        uint numerator = amountOut.saturatingMul(reserveIn).saturatingMul(1000);
        uint denominator = reserveOut.saturatingSub(amountOut).saturatingMul(
            997
        );
        amountIn = numerator.mulDiv(1, denominator, Math.Rounding.Ceil);
    }

    function _getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        // deltaY=deltaX*reserveOut/(reserveIn+deltaX)
        // Fee is 0.3%
        uint amountInWithFee = amountIn.saturatingMul(997);
        uint numerator = amountInWithFee.saturatingMul(reserveOut);
        uint denominator = reserveIn
            .saturatingAdd(amountInWithFee)
            .saturatingMul(1000);
        amountOut = numerator / denominator;
    }
}
