// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullMath} from "../FullMath.sol";

library SimpleBondingCurve {
    using FullMath for uint256;

    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2Ca%5D+%2B+b%2C%7Bx%2Cs%2B1%2Cs%2Bm%7D%5D
    function calculatePrice(
        uint256 supply,
        uint256 amount,
        uint256 slope,
        uint256 intercept
    ) internal pure returns (uint256) {
        return
            amount.mulDivRoundingUp(
                2 * slope * intercept + amount + 2 * supply + 1,
                2 * amount
            );
    }
}
