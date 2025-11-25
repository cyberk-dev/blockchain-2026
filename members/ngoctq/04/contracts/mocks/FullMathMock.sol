// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../libraries/FullMath.sol";

contract FullMathMock {
    function mulDiv(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (uint256 result) {
        return FullMath.mulDiv(a, b, denominator);
    }

    function mulDivRoundingUp(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (uint256 result) {
        return FullMath.mulDivRoundingUp(a, b, denominator);
    }
}
