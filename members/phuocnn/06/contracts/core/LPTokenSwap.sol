// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LPTokenRemoveLiquidity.sol";
import "../libraries/SwapMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPTokenSwap is LPTokenRemoveLiquidity {
    using SwapMath for uint256;
    using SafeERC20 for IERC20;

    function buyExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to
    ) external returns (uint256) {
        return _swapExactIn(amountIn, amountOutMin, tokenIn, to);
    }

    function buyExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address tokenOut,
        address to
    ) external returns (uint256) {
        return _swapExactOut(amountOut, amountInMax, tokenOut, to);
    }

    function sellExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to
    ) external returns (uint256) {
        return _swapExactIn(amountIn, amountOutMin, tokenIn, to);
    }

    function sellExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address tokenOut,
        address to
    ) external returns (uint256) {
        return _swapExactOut(amountOut, amountInMax, tokenOut, to);
    }

    function _swapExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to
    ) internal returns (uint256 amountOut) {
        require(
            amountIn > 0 && (tokenIn == token0 || tokenIn == token1),
            "LPToken: Invalid"
        );

        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn);
        amountOut = SwapMath.getAmountOut(amountIn, reserveIn, reserveOut);
        require(amountOut >= amountOutMin, "LPToken: Insufficient output");

        address tokenOut = _getOtherToken(tokenIn);
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
        _updateReservesAndEmit(amountIn, amountOut, tokenIn, tokenOut, to);
    }

    function _swapExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address tokenOut,
        address to
    ) internal returns (uint256 amountIn) {
        require(
            amountOut > 0 && (tokenOut == token0 || tokenOut == token1),
            "LPToken: Invalid"
        );

        (uint256 reserveOut, uint256 reserveIn) = _getReserves(tokenOut);
        amountIn = SwapMath.getAmountIn(amountOut, reserveIn, reserveOut);
        require(amountIn <= amountInMax, "LPToken: Excessive input");

        address tokenIn = _getOtherToken(tokenOut);
        IERC20(tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            amountInMax
        );
        if (amountIn < amountInMax) {
            IERC20(tokenIn).safeTransfer(msg.sender, amountInMax - amountIn);
        }
        IERC20(tokenOut).safeTransfer(to, amountOut);
        _updateReservesAndEmit(amountIn, amountOut, tokenIn, tokenOut, to);
    }

    function _getReserves(
        address token
    ) internal view returns (uint256 reserveIn, uint256 reserveOut) {
        (reserveIn, reserveOut) = token == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    function _getOtherToken(address token) internal view returns (address) {
        return token == token0 ? token1 : token0;
    }

    function _updateReservesAndEmit(
        uint256 amountIn,
        uint256 amountOut,
        address tokenIn,
        address tokenOut,
        address to
    ) internal {
        if (tokenIn == token0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
            emit Swap(msg.sender, amountIn, 0, 0, amountOut, to);
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
            emit Swap(msg.sender, 0, amountIn, amountOut, 0, to);
        }
        require(reserve0 * reserve1 >= k, "LPToken: K violated");
    }

    function getAmountOut(
        uint256 amountIn,
        address tokenIn
    ) external view returns (uint256) {
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn);
        return SwapMath.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(
        uint256 amountOut,
        address tokenOut
    ) external view returns (uint256) {
        (uint256 reserveOut, uint256 reserveIn) = _getReserves(tokenOut);
        return SwapMath.getAmountIn(amountOut, reserveIn, reserveOut);
    }
}
