// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/FullMath.sol";


contract LPToken is ERC20, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using FullMath for uint256;

  address public tokenX;
  address public tokenY;

  uint256 public reserveX;
  uint256 public reserveY;

  error InvalidAmount();
  error InvalidRatio();
  error InvalidLiquidity();
  error InvalidInput();
  error InvalidToken();
  error InsufficientLiquidity();
  error InsufficientOutputAmount();
  error SlippageExceeded();
  error InvalidOutput();
  error NotEnoughLiquidity();
  error InsufficientBalance();

  constructor(address _tokenX, address _tokenY) ERC20("LP Token", "LP") Ownable(msg.sender) {
    tokenX = _tokenX;
    tokenY = _tokenY;
  }

  function addLiquidity(
        uint256 amount0,
        uint256 amount1
    ) external nonReentrant returns (uint256 liquidity) {
        if (amount0 == 0 || amount1 == 0) {
          revert InvalidInput();
        }

        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = Math.max(amount0, amount1);
        } else {
            if (amount0 * reserveY != amount1 * reserveX) {
              revert InvalidRatio();
            }
            liquidity = amount0.mulDiv(supply, reserveX);
        }
        if (liquidity == 0) revert InsufficientLiquidity();
        
        IERC20(tokenX).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(tokenY).safeTransferFrom(msg.sender, address(this), amount1);

        reserveX += amount0;
        reserveY += amount1;

        _mint(msg.sender, liquidity);
    }

    function removeLiquidity(uint256 liquidity)
        external
        returns (uint256 amountX, uint256 amountY)
    {
        if (liquidity == 0) revert InvalidLiquidity();

        if (liquidity > balanceOf(msg.sender)) {
          revert InsufficientBalance();
        }

        amountX = liquidity.mulDiv(reserveX, totalSupply());
        amountY = liquidity.mulDiv(reserveY, totalSupply());

        reserveX -= amountX;
        reserveY -= amountY;

        IERC20(tokenX).safeTransfer(msg.sender, amountX);
        IERC20(tokenY).safeTransfer(msg.sender, amountY);

        _burn(msg.sender, liquidity);
    }

    function swapExactIn(
      address tokenIn,
      uint256 amountIn,
      uint256 minAmountOut
    ) external returns (uint256 amountOut) {
      if (amountIn == 0) revert InvalidInput();
      if (tokenIn != tokenX && tokenIn != tokenY) revert InvalidToken();

      (uint256 reserveIn, uint256 reserveOut, address tokenOut) = tokenIn == tokenX ? (reserveX, reserveY, tokenY) : (reserveY, reserveX, tokenX);

      if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

      uint256 amountInExcludeFee = amountIn.mulDiv(997, 1000);
      amountOut = amountInExcludeFee.mulDiv(reserveOut, reserveIn + amountInExcludeFee);
      if (amountOut == 0) revert InsufficientOutputAmount();
      if (amountOut < minAmountOut) revert SlippageExceeded();

      IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
      IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

      uint256 balanceX = IERC20(tokenX).balanceOf(address(this));
      uint256 balanceY = IERC20(tokenY).balanceOf(address(this));
      reserveX = balanceX;
      reserveY = balanceY;
    }

    function swapExactOut(
      address tokenIn,
      uint256 amountOut,
      uint256 maxAmountIn
    ) external returns (uint256 amountIn) {
      if (amountOut == 0) revert InvalidOutput();
      if (tokenIn != tokenX && tokenIn != tokenY) revert InvalidToken();

      (uint256 reserveIn, uint256 reserveOut, address tokenOut) = tokenIn == tokenX ? (reserveX, reserveY, tokenY) : (reserveY, reserveX, tokenX);

      if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

      amountIn = reserveIn.mulDivRoundingUp(amountOut * 1000, 997 * (reserveOut - amountOut));
      if (amountIn == 0) revert InsufficientOutputAmount();
      if (amountIn > maxAmountIn) revert SlippageExceeded();

      IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
      IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

      uint256 balanceX = IERC20(tokenX).balanceOf(address(this));
      uint256 balanceY = IERC20(tokenY).balanceOf(address(this));
      reserveX = balanceX;
      reserveY = balanceY;
    }
}