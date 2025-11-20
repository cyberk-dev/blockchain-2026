// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullMath} from "../FullMath.sol";

library SimpleBondingCurve {
    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5BPower%5Bx%2C2%5D%2Ca%5D%2C%7Bx%2Cs%2B1%2Cs%2BA%7D%5D
    // price = slope*x+intercept
    function calculatePrice(
        uint256 supply,
        uint256 amount,
        uint256 slope,
        uint256 intercept,
        uint256 decimals,
        uint256 slopePower
    ) internal pure returns (uint256) {
        return
            FullMath.mulDivRoundingUp(
                amount,
                (slope * (amount + 2 * supply + 1)),
                2 * 10 ** (decimals + slopePower)
            ) + FullMath.mulDivRoundingUp(amount, intercept, 10 ** decimals);
    }
}
