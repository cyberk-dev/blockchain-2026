// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPToken is ERC20 {
    using Math for uint256;
    using SafeERC20 for IERC20;

    address token0;
    address token1;

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

    constructor(address _token0, address _token1) ERC20("LPToken", "LP") {
        token0 = _token0;
        token1 = _token1;
    }

    function mintLiquidity(address to) external {
        uint256 balance0 = IERC20(token0).balanceOf(msg.sender);
        uint256 balance1 = IERC20(token1).balanceOf(msg.sender);

        uint256 amount0 = balance0.saturatingSub(reserve0);
        uint256 amount1 = balance1.saturatingSub(reserve1);

        uint256 _totalSupply = totalSupply();

        uint256 liquidity;

        // First mint
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1);
        } else {
            liquidity = Math.min(
                amount0.mulDiv(_totalSupply, reserve0),
                amount1.mulDiv(_totalSupply, reserve1)
            );
        }

        if (liquidity == 0) revert InsufficientLiquidity();

        _mint(to, liquidity);

        unchecked {
            reserve0 = balance0;
            reserve1 = balance1;
            kLast = reserve0.saturatingMul(reserve1);
        }

        emit LiquidityAdded(to, amount0, amount1, liquidity);
    }

    function burnLiquidity(address to) external {
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint liquidity = balanceOf(address(this)); // User need to send lp to pair first to burn
        uint _totalSupply = totalSupply();

        uint amount0 = balance0.mulDiv(liquidity, _totalSupply);
        uint amount1 = balance1.mulDiv(liquidity, _totalSupply);

        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();

        _burn(address(this), liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));

        unchecked {
            reserve0 = balance0;
            reserve1 = balance1;
            kLast = reserve0.saturatingMul(reserve1);
        }

        emit LiquidityRemoved(to, amount0, amount1, liquidity);
    }
}
