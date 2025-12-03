// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LPToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract LPTokenAddLiquidity is LPToken {
    using SafeERC20 for IERC20;

    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        require(reserve0 > 0 && reserve1 > 0, "LPToken: Pool not initialized");

        uint256 amount0Optimal = _quote(amount1Desired, reserve1, reserve0);
        if (amount0Optimal <= amount0Desired) {
            require(
                amount0Optimal >= amount0Min,
                "LPToken: Insufficient amount0"
            );
            (amount0, amount1) = (amount0Optimal, amount1Desired);
        } else {
            uint256 amount1Optimal = _quote(amount0Desired, reserve0, reserve1);
            require(
                amount1Optimal <= amount1Desired &&
                    amount1Optimal >= amount1Min,
                "LPToken: Insufficient amount1"
            );
            (amount0, amount1) = (amount0Desired, amount1Optimal);
        }

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        uint256 _totalSupply = totalSupply();
        liquidity = _totalSupply == 0
            ? (amount0 > amount1 ? amount0 : amount1)
            : _min(
                (amount0 * _totalSupply) / reserve0,
                (amount1 * _totalSupply) / reserve1
            );

        require(liquidity > 0, "LPToken: Insufficient liquidity minted");

        unchecked {
            reserve0 += amount0;
            reserve1 += amount1;
            k = reserve0 * reserve1;
        }

        _mint(to, liquidity);
        emit LiquidityAdded(to, amount0, amount1, liquidity);
    }

    function _quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256) {
        require(
            amountA > 0 && reserveA > 0 && reserveB > 0,
            "LPToken: Insufficient"
        );
        return (amountA * reserveB) / reserveA;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
