// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ILPToken {
    // Events
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

    // Errors
    error InsufficientLiquidity();
    error InsufficientLiquidityBurned();
    error InsufficientAmountOut();

    // Functions
    function mintLiquidity(address to) external;

    function burnLiquidity(address to) external;

    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external;

    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 amountInMax
    ) external;

    function getAmountIn(
        address tokenIn,
        address tokenOut,
        uint256 amountOutMin
    ) external view returns (uint256 amountIn);

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountInMax
    ) external view returns (uint256 amountOut);
}
