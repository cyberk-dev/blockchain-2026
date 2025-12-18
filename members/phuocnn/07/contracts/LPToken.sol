// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./FullMath.sol";

contract LPToken is ERC20 {
    using SafeERC20 for IERC20;
    using FullMath for uint256;

    address public token0;
    address public token1;

    uint256 public reserve0;
    uint256 public reserve1;

    error InvalidLiquidity();
    error InvalidAmount0();
    error InvalidAmount1();
    error InvalidInput();
    error InsufficientOutput();
    error InvalidToken();

    constructor() ERC20("LPToken", "LP") {}

    // 100 token A/ 
    // 1 token B

    // 100 token A (có cả fee)
    // => 99,7 token A
    // ? token B

    function initialize(
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _amount1
    ) external {
        require(token0 == address(0), "Already initialized");

        require(
            _token0 != address(0) && _token1 != address(0),
            "Invalid token"
        );
        require(_token0 != _token1, "Identical tokens");
        require(_amount0 > 0 && _amount1 > 0, "Invalid amounts");

        token0 = _token0;
        token1 = _token1;

        reserve0 = _amount0;
        reserve1 = _amount1;

        uint256 initialLiquidity = _amount0 > _amount1 ? _amount0 : _amount1;
        _mint(msg.sender, initialLiquidity);
    }

    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        // check pool is initialized
        require(reserve0 > 0 && reserve1 > 0, "Pool not initialized");

        // calculate optimal amounts
        uint256 amount0Optimal = _quote(amount1Desired, reserve1, reserve0);

        // check amount0Optimal is enough
        if (amount0Optimal <= amount0Desired) {
            // TH1: user has enough or more than amount0Desired
            require(amount0Optimal >= amount0Min, "Insufficient amount0");
            amount0 = amount0Optimal;
            amount1 = amount1Desired;
        } else {
            // TH2: user has less than token0
            uint256 amount1Optimal = _quote(amount0Desired, reserve0, reserve1);
            require(
                amount1Optimal <= amount1Desired &&
                    amount1Optimal >= amount1Min,
                "Insufficient amount1"
            );
            amount0 = amount0Desired;
            amount1 = amount1Optimal;
        }

        // transfer tokens
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        uint256 liquidity0 = (amount0 * totalSupply()) / reserve0;
        uint256 liquidity1 = (amount1 * totalSupply()) / reserve1;
        liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;

        reserve0 += amount0;
        reserve1 += amount1;

        _mint(to, liquidity);
    }

    function _quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256) {
        // check all amount > 0
        if (amountA == 0 || reserveA == 0 || reserveB == 0)
            revert InvalidInput();
        // formula: amountB = (amountA * reserveB) / reserveA
        return (amountA * reserveB) / reserveA;
    }

    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external returns (uint256 amount0, uint256 amount1) {
        if (reserve0 == 0 || reserve1 == 0) revert InvalidLiquidity();

        // check liquidity > 0
        if (liquidity == 0) revert InvalidLiquidity();

        amount0 = (liquidity * reserve0) / totalSupply();
        amount1 = (liquidity * reserve1) / totalSupply();

        if (amount0 < amount0Min) revert InvalidAmount0();
        if (amount1 < amount1Min) revert InvalidAmount1();

        _burn(msg.sender, liquidity);

        reserve0 -= amount0;
        reserve1 -= amount1;

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
    }

    function swap_amount_in(
        uint256 amountIn,
        address tokenIn,
        uint256 amountOutMin
    ) external returns (uint256 amountOut) {
        if (amountIn == 0) revert InvalidInput();
        if (tokenIn != token0 && tokenIn != token1) revert InvalidInput();

        uint256 reserveIn;
        uint256 reserveOut;

        if (tokenIn == token0) {
            reserveIn = reserve0;
            reserveOut = reserve1;
        } else {
            reserveIn = reserve1;
            reserveOut = reserve0;
        }

        uint256 amountInReal = amountIn.mulDiv(997, 1000);

        amountOut = FullMath.mulDiv(amountInReal, reserveOut, reserveIn + amountInReal);
        if (amountOut < amountOutMin) revert InsufficientOutput();

        address tokenOut = tokenIn == token0 ? token1 : token0;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        if (tokenIn == token0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }
    }

    function swap_exact_out(
        uint256 amountOut,
        uint256 amountInMax,
        address tokenOut
    ) external returns (uint256 amountIn) {
        if (amountOut == 0) revert InvalidInput();
        if (tokenOut != token0 && tokenOut != token1) revert InvalidToken();

        uint256 reserveIn;
        uint256 reserveOut;

        if (tokenOut == token0) {
            reserveIn = reserve1;
            reserveOut = reserve0;
        } else {
            reserveIn = reserve0;
            reserveOut = reserve1;
        }

        if (reserveOut < amountOut) revert InsufficientOutput();

        // amountInReal = amountInWithFee * 997 / 1000

        amountIn = FullMath.mulDivRoundingUp(
            amountOut,
            reserveIn * 1000,
            (reserveOut - amountOut) * 997
        );

        address tokenIn = tokenOut == token0 ? token1 : token0;

        IERC20(tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            amountInMax
        );

        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        if (tokenOut == token0) {
            reserve0 -= amountOut;
            reserve1 += amountIn;
        } else {
            reserve1 -= amountOut;
            reserve0 += amountIn;
        }

        if (amountIn > amountInMax) {
            IERC20(tokenIn).safeTransfer(msg.sender, amountInMax - amountIn);
        }
    }
}
