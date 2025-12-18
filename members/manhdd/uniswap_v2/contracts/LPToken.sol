// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FullMath} from "./FullMath.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract LPToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using FullMath for uint256;

    uint256 public constant BASE_PERCENT = 1000;
    uint256 public constant FEE_PERCENT = 3; // 0.3%

    address public tokenA;
    address public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityBurned
    );

    event Swap(
        address indexed swapper,
        address fromToken,
        uint256 amountIn,
        address toToken,
        uint256 amountOut
    );

    error InsufficientBalance(
        address token,
        uint256 requested,
        uint256 available
    );

    error AmountIsZero();

    error WrongRatio();

    error InsufficientLiquidity(
        address token,
        uint256 requested,
        uint256 available
    );

    error WrongTokenAddress();

    constructor(address _tokenA, address _tokenB) ERC20("LP Token", "LPT") {
        tokenA = _tokenA;
        tokenB = _tokenB;
        reserveA = 0;
        reserveB = 0;
    }

    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant {
        uint256 balanceABefore = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceBBefore = IERC20(tokenB).balanceOf(address(this));

        (uint256 currentRatioA, uint256 currentRatioB) = getCurrentRatio();

        if (reserveA != 0 && reserveB != 0) {
            uint256 providedRatioA = (amountA * 1e18) / amountB;
            uint256 providedRatioB = (amountB * 1e18) / amountA;

            if (
                providedRatioA != currentRatioA ||
                providedRatioB != currentRatioB
            ) {
                revert WrongRatio();
            }
        }

        if (amountA > IERC20(tokenA).balanceOf(msg.sender)) {
            revert InsufficientBalance(
                tokenA,
                amountA,
                IERC20(tokenA).balanceOf(msg.sender)
            );
        }
        if (amountB > IERC20(tokenB).balanceOf(msg.sender)) {
            revert InsufficientBalance(
                tokenB,
                amountB,
                IERC20(tokenB).balanceOf(msg.sender)
            );
        }

        if (amountA == 0 || amountB == 0) {
            revert AmountIsZero();
        }

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        uint256 balanceAAfter = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceBAfter = IERC20(tokenB).balanceOf(address(this));

        uint256 amountAAdded = balanceAAfter - balanceABefore;
        uint256 amountBAdded = balanceBAfter - balanceBBefore;

        if (totalSupply() == 0) {
            _mint(msg.sender, Math.sqrt(amountAAdded * amountBAdded));
        } else {
            uint256 liquidityA = FullMath.mulDiv(
                amountAAdded,
                totalSupply(),
                reserveA
            );
            uint256 liquidityB = FullMath.mulDiv(
                amountBAdded,
                totalSupply(),
                reserveB
            );
            uint256 liquidity = liquidityA < liquidityB
                ? liquidityA
                : liquidityB;
            _mint(msg.sender, liquidity);
        }

        reserveA += amountAAdded;
        reserveB += amountBAdded;

        emit LiquidityAdded(
            msg.sender,
            amountAAdded,
            amountBAdded,
            balanceOf(msg.sender)
        );
    }

    function removeLiquidity(uint256 lpAmount) external nonReentrant {
        uint256 share = FullMath.mulDiv(lpAmount, 1e18, totalSupply());

        uint256 amountA = FullMath.mulDiv(reserveA, share, 1e18);
        uint256 amountB = FullMath.mulDiv(reserveB, share, 1e18);

        if (lpAmount == 0) {
            revert AmountIsZero();
        }

        if (lpAmount > balanceOf(msg.sender)) {
            revert InsufficientBalance(
                address(this),
                lpAmount,
                balanceOf(msg.sender)
            );
        }

        _burn(msg.sender, lpAmount);

        reserveA -= amountA;
        reserveB -= amountB;

        IERC20(tokenA).safeTransfer(msg.sender, amountA);
        IERC20(tokenB).safeTransfer(msg.sender, amountB);

        emit LiquidityRemoved(
            msg.sender,
            amountA,
            amountB,
            balanceOf(msg.sender)
        );
    }

    function swapExactIn(
        address fromToken,
        uint256 amountIn,
        address toToken,
        uint256 minAmountOut
    ) external nonReentrant {
        if (amountIn == 0) {
            revert AmountIsZero();
        }

        if (fromToken != tokenA && fromToken != tokenB) {
            revert WrongTokenAddress();
        }
        if (toToken != tokenA && toToken != tokenB) {
            revert WrongTokenAddress();
        }
        if (fromToken == toToken) {
            revert WrongTokenAddress();
        }

        if (amountIn > IERC20(fromToken).balanceOf(msg.sender)) {
            revert InsufficientBalance(
                fromToken,
                amountIn,
                IERC20(fromToken).balanceOf(msg.sender)
            );
        }

        uint256 amountOut = getAmountOut(amountIn, fromToken);

        if (fromToken == tokenA) {
            if (amountOut > reserveB) {
                revert InsufficientLiquidity(tokenB, amountOut, reserveB);
            }
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            if (amountOut > reserveA) {
                revert InsufficientLiquidity(tokenA, amountOut, reserveA);
            }
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        if (amountOut < minAmountOut) {
            revert InsufficientLiquidity(toToken, minAmountOut, amountOut);
        }

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        emit Swap(msg.sender, fromToken, amountIn, toToken, amountOut);
    }

    function swapExactOut(
        address fromToken,
        uint256 maxAmountIn,
        address toToken,
        uint256 amountOut
    ) external nonReentrant {
        if (amountOut == 0) {
            revert AmountIsZero();
        }

        if (fromToken != tokenA && fromToken != tokenB) {
            revert WrongTokenAddress();
        }
        if (toToken != tokenA && toToken != tokenB) {
            revert WrongTokenAddress();
        }
        if (fromToken == toToken) {
            revert WrongTokenAddress();
        }

        uint256 amountIn = getAmountIn(amountOut, toToken);
        if (toToken == tokenA) {
            if (amountIn > reserveB) {
                revert InsufficientLiquidity(tokenB, amountIn, reserveB);
            }
            reserveA -= amountOut;
            reserveB += amountIn;
        } else {
            if (amountIn > reserveA) {
                revert InsufficientLiquidity(tokenA, amountIn, reserveA);
            }
            reserveB -= amountOut;
            reserveA += amountIn;
        }

        if (amountIn > maxAmountIn) {
            revert InsufficientLiquidity(fromToken, maxAmountIn, amountIn);
        }

        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(toToken).safeTransfer(msg.sender, amountOut);

        emit Swap(msg.sender, fromToken, amountIn, toToken, amountOut);
    }

    function getAmountOut(
        uint256 amountIn,
        address fromToken
    ) public view returns (uint256) {
        if (fromToken != tokenA && fromToken != tokenB) {
            revert WrongTokenAddress();
        }

        uint256 amountInAfterFee = (amountIn * (BASE_PERCENT - FEE_PERCENT)) /
            BASE_PERCENT;

        uint256 amountOut;
        if (fromToken == tokenA) {
            amountOut = FullMath.mulDiv(
                amountInAfterFee,
                reserveB,
                reserveA + amountInAfterFee
            );
        } else {
            amountOut = FullMath.mulDiv(
                amountInAfterFee,
                reserveA,
                reserveB + amountInAfterFee
            );
        }

        return amountOut;
    }

    function getAmountIn(
        uint256 amountOut,
        address toToken
    ) public view returns (uint256) {
        if (toToken != tokenA && toToken != tokenB) {
            revert WrongTokenAddress();
        }

        uint256 amountIn;
        if (toToken == tokenA) {
            amountIn = FullMath.mulDivRoundingUp(
                reserveB * BASE_PERCENT,
                amountOut,
                (reserveA - amountOut) * (BASE_PERCENT - FEE_PERCENT)
            );
        } else {
            amountIn = FullMath.mulDivRoundingUp(
                reserveA * BASE_PERCENT,
                amountOut,
                (reserveB - amountOut) * (BASE_PERCENT - FEE_PERCENT)
            );
        }

        return amountIn;
    }

    function getCurrentRatio() public view returns (uint256, uint256) {
        if (reserveB == 0) {
            return (0, 0);
        }
        uint256 ratioA = FullMath.mulDiv(reserveA, 1e18, reserveB);
        uint256 ratioB = FullMath.mulDiv(reserveB, 1e18, reserveA);

        return (ratioA, ratioB);
    }

    function getLPLiquidity() external view returns (uint256) {
        return totalSupply();
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        uint256 k = reserveA * reserveB;
        return (reserveA, reserveB, k);
    }
}
