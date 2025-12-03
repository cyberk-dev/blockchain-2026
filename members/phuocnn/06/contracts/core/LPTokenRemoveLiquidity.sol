// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LPTokenAddLiquidity.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract LPTokenRemoveLiquidity is LPTokenAddLiquidity {
    using SafeERC20 for IERC20;

    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "LPToken: Insufficient liquidity");

        uint256 _totalSupply = totalSupply();
        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;

        require(amount0 >= amount0Min, "LPToken: Insufficient amount0");
        require(amount1 >= amount1Min, "LPToken: Insufficient amount1");

        _burn(msg.sender, liquidity);

        unchecked {
            reserve0 -= amount0;
            reserve1 -= amount1;
            k = reserve0 * reserve1;
        }

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }
}
