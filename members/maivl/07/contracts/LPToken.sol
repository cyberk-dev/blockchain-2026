// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FullMath} from "./FullMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LPToken {
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    address public token0;
    address public token1;

    uint256 public reserve0;
    uint256 public reserve1;

    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    string public constant name = "LP Token";
    string public constant symbol = "LP";
    uint8 public constant decimals = 18;

    error NoLiquidityAdded();
    error NoLiquidityRemoved();
    error InsufficientAmountOut();

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }

    function addLiquidity(address to) external returns (uint256 liquidity) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0 = balance0 - reserve0;
        uint256 amount1 = balance1 - reserve1;

        if (amount0 == 0 || amount1 == 0) {
            revert NoLiquidityAdded();
        }

        if (totalSupply == 0) {
            liquidity = amount0 > amount1 ? amount0 : amount1;
        } else {
            uint256 liquidity0 = amount0.mulDiv(totalSupply, reserve0);
            uint256 liquidity1 = amount1.mulDiv(totalSupply, reserve1);
            liquidity = liquidity0 > liquidity1 ? liquidity0 : liquidity1;
        }

        if (liquidity == 0) {
            revert NoLiquidityAdded();
        }

        _mint(to, liquidity);
        _update(balance0, balance1);
    }

    function removeLiquidity(
        address to
    ) external returns (uint256 amount0, uint256 amount1) {
        uint256 liquidity = balanceOf[msg.sender];
        if (liquidity == 0) {
            revert NoLiquidityRemoved();
        }

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        amount0 = liquidity.mulDiv(balance0, totalSupply);
        amount1 = liquidity.mulDiv(balance1, totalSupply);

        _burn(msg.sender, liquidity);

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);

        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));

        _update(balance0, balance1);
    }

    function swap_exact_in(
        address fromToken,
        uint256 amountIn,
        address toToken,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        uint256 amountInWithFee = amountIn.mulDiv(997, 1000);
        uint256 amountOut = amountInWithFee.mulDiv(balance1, balance0 + amountInWithFee);

        if (amountOut < minAmountOut) {
            revert InsufficientAmountOut();
        }

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        _update(balance0, balance1);

        return amountOut;
    }

    function _update(uint256 balance0, uint256 balance1) internal {
        reserve0 = balance0;
        reserve1 = balance1;
    }
}
