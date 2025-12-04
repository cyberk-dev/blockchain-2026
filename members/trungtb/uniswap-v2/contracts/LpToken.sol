// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { FullMath } from "./libraries/FullMath.sol";

contract LPToken is ERC20, ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;
  using FullMath for uint256;

  address public tokenX;
  address public tokenY;

  uint256 public reserveX;
  uint256 public reserveY;

  error InvalidAmount();
  error InvalidLiquidity();
  error InvalidInput();
  error InvalidToken();
  error InsufficientLiquidity();
  error InsufficientOutputAmount();
  error SlippageExceeded();
  error InvalidOutput();
  error NotEnoughLiquidity();

  constructor(address _tokenX, address _tokenY) ERC20("LP Token", "LP") Ownable(msg.sender) {
    tokenX = _tokenX;
    tokenY = _tokenY;
  }

  function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
    if (amountIn == 0) return 0;
    // Apply 0.3% fee: amountInWithFee = amountIn * 997 / 1000
    uint256 amountInWithFee = amountIn.mulDiv(997, 1000);
    amountOut = amountInWithFee.mulDiv(reserveOut, reserveIn + amountInWithFee);
  }

  function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountIn) {
    if (amountOut == 0) return 0;
    // Apply 0.3% fee: amountIn = (amountOut * reserveIn * 1000) / ((reserveOut - amountOut) * 997)
    amountIn = amountOut.mulDiv(reserveIn * 1000, (reserveOut - amountOut) * 997);
  }

  function addLiquidity(uint256 _amountX, uint256 _amountY) external returns (uint256 liquidity) {
    if (_amountX == 0 || _amountY == 0) {
      revert InvalidAmount();
    }

    if (totalSupply() == 0) {
      liquidity = Math.sqrt(_amountX * _amountY);
    } else {
      liquidity = Math.min(
        _amountX.mulDiv(totalSupply(), reserveX),
        _amountY.mulDiv(totalSupply(), reserveY)
      );
    }
    if (liquidity == 0) revert InvalidLiquidity();

    reserveX += _amountX;
    reserveY += _amountY;

    IERC20(tokenX).safeTransferFrom(msg.sender, address(this), _amountX);
    IERC20(tokenY).safeTransferFrom(msg.sender, address(this), _amountY);

    _mint(msg.sender, liquidity);

    return liquidity;
  }

    function removeLiquidity(uint256 liquidity)
        external
        returns (uint256 amountX, uint256 amountY)
    {
        if (liquidity == 0) revert InvalidLiquidity();

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
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {

        if (amountIn == 0) revert InvalidInput();

        bool isTokenX = tokenIn == tokenX;
        if (!isTokenX && tokenIn != tokenY) revert InvalidToken();

        (uint256 reserveIn, uint256 reserveOut, address tokenOut) = isTokenX
            ? (reserveX, reserveY, tokenY)
            : (reserveY, reserveX, tokenX);

        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        // Apply 0.3% fee: amountInWithFee = amountIn * 997 / 1000
        // Formula with fee: (x + d_x * 0.997) * (y - d_y) = k
        // d_y = (d_x * 0.997 * y) / (x + d_x * 0.997)
        uint256 amountInWithFee = amountIn.mulDiv(997, 1000);
        amountOut = amountInWithFee.mulDiv(reserveOut, reserveIn + amountInWithFee);
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (amountOut < minAmountOut) revert SlippageExceeded();

        if (isTokenX) {
          reserveX += amountIn;
          reserveY -= amountOut;
        } else {
          reserveY += amountIn;
          reserveX -= amountOut;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
    }

    function swapExactOut(
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        address to
    ) external returns (uint256 amountIn) {

        if (amountOut == 0) revert InvalidOutput();
        bool isTokenX = tokenOut == tokenX;
        if (!isTokenX && tokenOut != tokenY) revert InvalidToken();

        (uint256 reserveOut, uint256 reserveIn, address tokenIn) = isTokenX
            ? (reserveX, reserveY, tokenY)
            : (reserveY, reserveX, tokenX);

        if (amountOut >= reserveOut) revert NotEnoughLiquidity();

        // Apply 0.3% fee: amountInWithFee = amountIn * 997 / 1000
        // Formula: (x + d_x * 0.997) * (y - d_y) = k
        // d_x = (x * d_y * 1000) / ((y - d_y) * 997)
        amountIn = amountOut.mulDiv(reserveIn * 1000, (reserveOut - amountOut) * 997);
        if (amountIn > maxAmountIn) revert SlippageExceeded();

        if (isTokenX) {
          reserveX -= amountOut;
          reserveY += amountIn;
        } else {
          reserveY -= amountOut;
          reserveX += amountIn;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
    }

}