// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../libraries/FullMath.sol";

contract LPToken is ERC20, ReentrancyGuard {
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    address public token0;
    address public token1;

    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public constant FULL_BPS = 1000;
    uint256 public constant FEE_BPS = 3;

    error InsufficientLiquidity();
    error SlippageProtection();
    error AmountIsZero();
    error WrongRatio();

    event LiquidityAdded(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

    event Swap(
        address indexed swapper,
        address fromToken,
        uint256 amountIn,
        address toToken,
        uint256 amountOut
    );

    constructor(address _token0, address _token1) ERC20("LPToken", "LP") {
        token0 = _token0;
        token1 = _token1;
    }

    function addLiquidity(
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant returns (uint256 liquidity) {
        uint256 realAmount0;
        uint256 realAmount1;
        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = Math.max(amount0, amount1);
            realAmount0 = amount0;
            realAmount1 = amount1;
        } else {
            uint256 expectedAmount1 = amount0.mulDiv(reserve1, reserve0);
            if (expectedAmount1 <= amount1) {
                realAmount0 = amount0;
                realAmount1 = expectedAmount1;
            } else {
                uint256 expectedAmount0 = amount1.mulDiv(reserve0, reserve1);
                realAmount0 = expectedAmount0;
                realAmount1 = amount1;
            }
            liquidity = totalSupply().mulDiv(realAmount0, reserve0);
        }
        if (liquidity == 0) revert InsufficientLiquidity();
        reserve0 += realAmount0;
        reserve1 += realAmount1;
        IERC20(token0).safeTransferFrom(msg.sender, address(this), realAmount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), realAmount1);
        _mint(msg.sender, liquidity);

        emit LiquidityAdded(msg.sender, realAmount0, realAmount1, liquidity);
    }

    function removeLiquidity(
        uint256 liquidity
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (liquidity == 0) revert InsufficientLiquidity();
        uint256 supply = totalSupply();
        amount0 = liquidity.mulDiv(reserve0, supply);
        amount1 = liquidity.mulDiv(reserve1, supply);
        reserve0 -= amount0;
        reserve1 -= amount1;
        IERC20(token0).safeTransfer(msg.sender, amount0);
        IERC20(token1).safeTransfer(msg.sender, amount1);
        _burn(msg.sender, liquidity);

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        uint256 amountInWithOutFee = amountIn.mulDivRoundingUp(FULL_BPS - FEE_BPS, FULL_BPS);
        amountOut = amountInWithOutFee.mulDiv(reserveOut, reserveIn + amountInWithOutFee);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountIn) {
        if (amountOut == 0) return 0;
        amountIn = amountOut.mulDivRoundingUp(
            reserveIn * FULL_BPS,
            (reserveOut - amountOut) * (FULL_BPS - FEE_BPS)
        );
    }

    function swapExactIn(
        uint256 amountIn,
        bool isBuy,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientLiquidity();
        (IERC20 tIn, IERC20 tOut, uint256 rIn, uint256 rOut) = isBuy
            ? (IERC20(token1), IERC20(token0), reserve1, reserve0)
            : (IERC20(token0), IERC20(token1), reserve0, reserve1);
        uint256 effectiveIn = amountIn.mulDivRoundingUp(FULL_BPS - FEE_BPS, FULL_BPS);
        amountOut = getAmountOut(effectiveIn, rIn, rOut);
        if (amountOut < minAmountOut) revert SlippageProtection();
        if (isBuy) {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        } else {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        }
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);

        emit Swap(msg.sender, address(tIn), amountIn, address(tOut), amountOut);
    }

    function swapExactOut(
        uint256 amountOut,
        address tokenIn,
        uint256 maxAmountIn
    ) external nonReentrant returns (uint256 amountIn) {
        if (tokenIn != token0 && tokenIn != token1) revert WrongRatio();
        bool isBuy = tokenIn == token1;
        (IERC20 tIn, IERC20 tOut, uint256 rIn, uint256 rOut) = isBuy
            ? (IERC20(token1), IERC20(token0), reserve1, reserve0)
            : (IERC20(token0), IERC20(token1), reserve0, reserve1);
        uint256 _amountIn = getAmountIn(amountOut, rIn, rOut);
        amountIn = _amountIn.mulDivRoundingUp(FULL_BPS, FULL_BPS - FEE_BPS);
        if (amountIn == 0) revert InsufficientLiquidity();
        if (amountIn > maxAmountIn) revert SlippageProtection();
        if (isBuy) {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        } else {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        }
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);

        emit Swap(msg.sender, address(tIn), amountIn, address(tOut), amountOut);
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        uint256 k = reserve0 * reserve1;
        return (reserve0, reserve1, k);
    }
}
