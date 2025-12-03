// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SwapMath {
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public constant FEE = 3; // 0.3%

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "SwapMath: Insufficient input amount");
        require(
            reserveIn > 0 && reserveOut > 0,
            "SwapMath: Insufficient liquidity"
        );

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - FEE);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "SwapMath: Insufficient output amount");
        require(
            reserveIn > 0 && reserveOut > 0,
            "SwapMath: Insufficient liquidity"
        );
        require(amountOut < reserveOut, "SwapMath: Insufficient liquidity");

        uint256 numerator = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveOut - amountOut) *
            (FEE_DENOMINATOR - FEE);
        amountIn = (numerator / denominator) + 1;
    }
}
