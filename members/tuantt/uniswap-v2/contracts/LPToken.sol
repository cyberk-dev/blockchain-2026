// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FullMath} from "./libraries/FullMath.sol";
import {Math} from "./libraries/Math.sol";

contract LPToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant FEE_DENOMINATOR = 1000;
    uint256 private constant FEE_NUMERATOR = 970; // 3% fee

    IERC20 public token0;
    IERC20 public token1;

    uint256 public reserve0;
    uint256 public reserve1;
    error ZeroAddress();
    error IdenticalTokens();
    error ZeroAmount();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error ExcessiveInputAmount();
    error InsufficientLiquidity();
    error SlippageExceeded();
    error InvalidTo();
    error InvalidToken();

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(
        address indexed sender,
        uint256 amount0,
        uint256 amount1,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token0, address _token1) external initializer {
        __ERC20_init("Uniswap V2 LP", "UNISWAP-V2-LP");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        if (_token0 == address(0) || _token1 == address(0)) {
            revert ZeroAddress();
        }
        if (_token0 == _token1) revert IdenticalTokens();

        (address t0, address t1) = _token0 < _token1
            ? (_token0, _token1)
            : (_token1, _token0);
        token0 = IERC20(t0);
        token1 = IERC20(t1);
    }

    function swapExactIn(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (tokenIn != address(token0) && tokenIn != address(token1))
            revert InvalidToken();

        (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);

        bool isToken0 = tokenIn == address(token0);
        (IERC20 inToken, IERC20 outToken) = isToken0
            ? (token0, token1)
            : (token1, token0);
        (uint256 reserveIn, uint256 reserveOut) = isToken0
            ? (_reserve0, _reserve1)
            : (_reserve1, _reserve0);

        inToken.safeTransferFrom(msg.sender, address(this), amountIn);
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (amountOut < minAmountOut) revert SlippageExceeded();

        outToken.safeTransfer(msg.sender, amountOut);

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));

        _update(balance0, balance1);
    }

    function swapExactOut(
        address tokenIn,
        uint256 amountOut,
        uint256 maxAmountIn
    ) external nonReentrant returns (uint256 amountIn) {
        if (amountOut == 0) revert ZeroAmount();
        if (tokenIn != address(token0) && tokenIn != address(token1))
            revert InvalidToken();

        (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);

        bool isToken0 = tokenIn == address(token0);
        (IERC20 inToken, IERC20 outToken) = isToken0
            ? (token0, token1)
            : (token1, token0);
        (uint256 reserveIn, uint256 reserveOut) = isToken0
            ? (_reserve0, _reserve1)
            : (_reserve1, _reserve0);

        amountIn = getAmountIn(amountOut, reserveIn, reserveOut);
        if (amountIn == 0) revert ZeroAmount();
        if (amountIn > maxAmountIn) revert SlippageExceeded();

        inToken.safeTransferFrom(msg.sender, address(this), amountIn);
        outToken.safeTransfer(msg.sender, amountOut);

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));

        _update(balance0, balance1);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 _reserveIn,
        uint256 _reserveOut
    ) internal pure returns (uint256) {
        if (amountOut == 0) revert ZeroAmount();
        if (_reserveIn == 0 || _reserveOut == 0) revert InsufficientLiquidity();
        if (amountOut >= _reserveOut) revert InsufficientLiquidity();

        uint256 numerator = _reserveIn * amountOut;
        uint256 denominator = (_reserveOut - amountOut) * FEE_NUMERATOR;
        return numerator.mulDivRoundingUp(FEE_DENOMINATOR, denominator);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 _reserveIn,
        uint256 _reserveOut
    ) internal pure returns (uint256) {
        if (amountIn == 0) revert ZeroAmount();
        if (_reserveIn == 0 || _reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn.mulDiv(
            FEE_NUMERATOR,
            FEE_DENOMINATOR
        );
        uint256 numerator = amountInWithFee * _reserveOut;
        uint256 denominator = _reserveIn + amountInWithFee;
        return numerator / denominator;
    }

    function addLiquidity(
        uint256 amount0,
        uint256 amount1,
        address to
    ) external nonReentrant returns (uint256 liquidity) {
        if (to == address(0)) revert InvalidTo();
        if (amount0 == 0 || amount1 == 0) revert ZeroAmount();
        (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);

        uint256 _amount0;
        uint256 _amount1;
        uint256 supply = totalSupply();

        if (supply == 0) {
            _amount0 = amount0;
            _amount1 = amount1;
            liquidity = Math.sqrt(amount0 * amount1);
        } else {
            uint256 amount1Optimal = amount0.mulDiv(_reserve1, _reserve0);
            if (amount1Optimal <= amount1) {
                _amount0 = amount0;
                _amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = amount1.mulDiv(_reserve0, _reserve1);
                _amount0 = amount0Optimal;
                _amount1 = amount1;
            }

            liquidity = Math.min(
                _amount0.mulDiv(supply, _reserve0),
                _amount1.mulDiv(supply, _reserve1)
            );
        }

        if (liquidity == 0) revert InsufficientLiquidityMinted();

        token0.safeTransferFrom(msg.sender, address(this), _amount0);
        token1.safeTransferFrom(msg.sender, address(this), _amount1);

        _mint(to, liquidity);
        _update(_reserve0 + _amount0, _reserve1 + _amount1);

        emit Mint(msg.sender, _amount0, _amount1);
    }

    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (liquidity == 0) revert ZeroAmount();
        if (to == address(0)) revert InvalidTo();

        (uint256 _reserve0, uint256 _reserve1) = (reserve0, reserve1);
        uint256 _totalSupply = totalSupply();
        amount0 = liquidity.mulDiv(_reserve0, _totalSupply);
        amount1 = liquidity.mulDiv(_reserve1, _totalSupply);

        if (amount0 < amount0Min || amount1 < amount1Min)
            revert InsufficientLiquidityBurned();

        _burn(msg.sender, liquidity);

        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);

        _update(_reserve0 - amount0, _reserve1 - amount1);

        emit Burn(msg.sender, amount0, amount1, to);
    }

    function _update(uint256 _reserve0, uint256 _reserve1) private {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        emit Sync(uint112(reserve0), uint112(reserve1));
    }
}
