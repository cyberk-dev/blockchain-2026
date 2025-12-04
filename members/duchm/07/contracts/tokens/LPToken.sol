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

    error InsufficientLiquidity();
    error SlippageProtection();
    error InvalidToken();

    constructor(address _token0, address _token1) ERC20("LPToken", "LP") {
        token0 = _token0;
        token1 = _token1;
    }

    function addLiquidity(
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant returns (uint256 liquidity) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = Math.sqrt(amount0 * amount1);
        } else {
            liquidity = Math.min(
                amount0.mulDiv(supply, reserve0),
                amount1.mulDiv(supply, reserve1)
            );
        }
        if (liquidity == 0) revert InsufficientLiquidity();
        unchecked {
            reserve1 += amount1;
            reserve0 += amount0;
        }
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);
        _mint(msg.sender, liquidity);
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
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        amountOut = amountIn.mulDiv(reserveOut, reserveIn + amountIn);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountIn) {
        if (amountOut == 0) return 0;
        amountIn = amountOut.mulDivRoundingUp(
            reserveIn,
            reserveOut - amountOut
        );
    }

    function getSwapDirection(
        address tokenIn
    )
        public
        view
        returns (
            bool isBuy,
            IERC20 tokenOut,
            uint256 reserveIn,
            uint256 reserveOut
        )
    {
        isBuy = tokenIn == token1;
        (IERC20 tIn, IERC20 tOut, uint256 rIn, uint256 rOut) = isBuy
            ? (IERC20(token1), IERC20(token0), reserve1, reserve0)
            : (IERC20(token0), IERC20(token1), reserve0, reserve1);
        if (address(tIn) != tokenIn) revert InvalidToken();
        return (isBuy, tOut, rIn, rOut);
    }

    function swapExactIn(
        uint256 amountIn,
        address tokenIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientLiquidity();
        IERC20 tIn = IERC20(tokenIn);
        (bool isBuy, IERC20 tOut, uint256 rIn, uint256 rOut) = getSwapDirection(
            tokenIn
        );
        uint256 effectiveIn = amountIn.mulDiv(997, 1000);
        amountOut = getAmountOut(effectiveIn, rIn, rOut);
        if (amountOut < minAmountOut) revert SlippageProtection();
        unchecked {
            if (isBuy) {
                reserve1 += amountIn;
                reserve0 -= amountOut;
            } else {
                reserve0 += amountIn;
                reserve1 -= amountOut;
            }
        }
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);
    }

    function swapExactOut(
        uint256 amountOut,
        address tokenOut,
        uint256 maxAmountIn
    ) external nonReentrant returns (uint256 amountIn) {
        address tokenIn = tokenOut == token0 ? token1 : token0;
        if (tokenOut != token0 && tokenOut != token1) revert InvalidToken();
        IERC20 tIn = IERC20(tokenIn);
        (bool isBuy, IERC20 tOut, uint256 rIn, uint256 rOut) = getSwapDirection(
            tokenIn
        );
        uint256 _amountIn = getAmountIn(amountOut, rIn, rOut);
        amountIn = _amountIn.mulDiv(1000, 997);
        if (amountIn == 0) revert InsufficientLiquidity();
        if (amountIn > maxAmountIn) revert SlippageProtection();
        unchecked {
            if (isBuy) {
                reserve1 += amountIn;
                reserve0 -= amountOut;
            } else {
                reserve0 += amountIn;
                reserve1 -= amountOut;
            }
        }
        tIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tOut.safeTransfer(msg.sender, amountOut);
    }
}
