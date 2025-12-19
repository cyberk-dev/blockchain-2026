// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidToken();
    error IdenticalTokens();
    error InvalidFee();
    error InsufficientReserves();
    error InsufficientLiquidity();

    event LiquidityAdded(
        address indexed sender,
        address indexed to,
        uint256 amountX,
        uint256 amountY,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed sender,
        address indexed to,
        uint256 amountX,
        uint256 amountY,
        uint256 liquidity
    );
    event Swap(
        address indexed sender,
        address to,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );
    event Sync(uint256 reserveX, uint256 reserveY);

    address public immutable tokenX;
    address public immutable tokenY;

    uint256 public reserveX; // reserve of tokenX
    uint256 public reserveY; // reserve of tokenY
    // fee
    uint256 public fee = 3; // 0.3%
    uint256 public constant FEE_DENOMINATOR = 1000;

    // bool private _locked;

    constructor(address tokenX_, address tokenY_) ERC20("LP Token", "LPT") {
        if (tokenX_ == address(0) || tokenY_ == address(0)) {
            revert ZeroAddress();
        }
        if (tokenX_ == tokenY_) revert IdenticalTokens();
        tokenX = tokenX_;
        tokenY = tokenY_;
    }

    function addLiquidity(
        uint256 dx,
        uint256 dy,
        address to
    ) external nonReentrant returns (uint256 lp) {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (dx == 0 || dy == 0) {
            revert ZeroAmount();
        }

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            lp = Math.sqrt(dx * dy);
        } else {
            if (reserveX == 0 || reserveY == 0) revert InsufficientReserves();
            uint256 dyExpected = (dx * reserveY) / reserveX;
            if (dyExpected > dy) {
                uint256 dxExpected = (dy * reserveX) / reserveY;
                dx = dxExpected;
            } else {
                dy = dyExpected;
            }
            lp = Math.min((dx * _totalSupply) / reserveX, (dy * _totalSupply) / reserveY);
        }
        if (lp == 0) {
            revert InsufficientLiquidity();
        }

        reserveX += dx;
        reserveY += dy;

        IERC20(tokenX).safeTransferFrom(msg.sender, address(this), dx);
        IERC20(tokenY).safeTransferFrom(msg.sender, address(this), dy);
        _mint(to, lp);

        emit LiquidityAdded(msg.sender, to, dx, dy, lp);
        emit Sync(reserveX, reserveY);
    }

    function removeLiquidity(
        uint256 lp,
        address to
    ) external nonReentrant returns (uint256 dx, uint256 dy) {
        if (to == address(0)) revert ZeroAddress();
        if (lp == 0) revert ZeroAmount();

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) revert InsufficientLiquidity();
        dx = (lp * reserveX) / _totalSupply;
        dy = (lp * reserveY) / _totalSupply;

        if (dx == 0 || dy == 0) {
            revert InsufficientLiquidity();
        }
        if (dx > reserveX || dy > reserveY) revert InsufficientReserves();

        _burn(msg.sender, lp);
        reserveX -= dx;
        reserveY -= dy;

        IERC20(tokenX).safeTransfer(to, dx);
        IERC20(tokenY).safeTransfer(to, dy);

        emit LiquidityRemoved(msg.sender, to, dx, dy, lp);
        emit Sync(reserveX, reserveY);
    }

    function getAmoutOut(
        uint256 amountIn,
        address tokenIn,
        uint256 reserveIn, // reserveX
        uint256 reserveOut // reserveY
    ) public view returns (uint256 amountOut) {
        if (tokenIn != tokenX && tokenIn != tokenY) {
            revert InvalidToken();
        }
        if (amountIn == 0) {
            revert ZeroAmount();
        }
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientReserves();

        uint256 dx = amountIn * _feeFactor();
        //uint256 top = dx * reserveOut;
        uint256 bot = reserveIn * FEE_DENOMINATOR + dx;
        //amountOut = top / bot;
        amountOut = dx.mulDiv(reserveOut, bot);
    }

    function swapExactIn(
        address tokenIn,
        uint256 amountIn,
        address to
    ) external nonReentrant returns (uint256 amountOut) {
        uint256 reserveIn;
        uint256 reserveOut;
        bool xToY;
        address tokenOut;

        if (tokenIn == tokenX) {
            reserveIn = reserveX;
            reserveOut = reserveY;
            xToY = true;
            tokenOut = tokenY;
        } else if (tokenIn == tokenY) {
            reserveIn = reserveY;
            reserveOut = reserveX;
            xToY = false;
            tokenOut = tokenX;
        } else {
            revert InvalidToken();
        }
        if (to == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        amountOut = getAmoutOut(amountIn, tokenIn, reserveIn, reserveOut);
        if (amountOut == 0 || amountOut >= reserveOut) revert InsufficientReserves();

        // update reserve
        if (xToY) {
            reserveX = reserveIn + amountIn;
            reserveY = reserveOut - amountOut;
        } else {
            reserveY = reserveIn + amountIn;
            reserveX = reserveOut - amountOut;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit Swap(msg.sender, to, tokenIn, amountIn, tokenOut, amountOut);
        emit Sync(reserveX, reserveY);
    }

    // swapExactOut
    //     reserveIn  = reserveX
    // reserveOut = reserveY
    // amountOut  = dy
    // amountIn   = dx ?

    // => reserveX' = reserveX + dx
    // => reserveY' = reserveY - dy

    function getAmoutIn(
        uint256 amountOut,
        address tokenOut,
        uint256 reserveIn, // reserveX
        uint256 reserveOut // reserveY
    ) public view returns (uint256 amountIn) {
        if (tokenOut != tokenX && tokenOut != tokenY) {
            revert InvalidToken();
        }
        if (amountOut == 0) {
            revert ZeroAmount();
        }
        if (reserveIn == 0 || reserveOut == 0 || amountOut >= reserveOut) {
            revert InsufficientReserves();
        }

        // (reserveX+dx)*(reserveY - dy) = reserveX*reserveY
        // => reserveX*reserveY - reserveX*dy + dx*reserveY - dx*dy = reserveX*reserveY
        // => dx*reserveY - dx*dy = reserveX*dy
        // => dx*(reserveY - dy) = reserveX*dy
        // => dx = (reserveX*dy) / (reserveY - dy)

        // dxReal = dx / 0.997 = (reserveX * dy * 1000) / (997 * (reserveY - dy))

        uint256 feeFactor = _feeFactor();
        uint256 top = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 bot = (reserveOut - amountOut) * feeFactor;
        amountIn = top.mulDiv(1, bot);
    }

    // swapExactOut
    function swapExactOut(
        address tokenOut,
        uint256 amountOut,
        address to
    ) external nonReentrant returns (uint256 amountIn) {
        uint256 reserveIn;
        uint256 reserveOut;
        bool xToY;
        address tokenIn;

        if (tokenOut == tokenY) {
            reserveIn = reserveX;
            reserveOut = reserveY;
            xToY = true;
            tokenIn = tokenX;
        } else if (tokenOut == tokenX) {
            reserveIn = reserveY;
            reserveOut = reserveX;
            xToY = false;
            tokenIn = tokenY;
        } else {
            revert InvalidToken();
        }
        if (to == address(0)) revert ZeroAddress();
        if (amountOut == 0) revert ZeroAmount();
        if (amountOut >= reserveOut) revert InsufficientReserves();

        amountIn = getAmoutIn(
            amountOut,
            tokenOut,
            reserveIn,
            reserveOut
        );
        if (amountIn == 0) revert InsufficientLiquidity();

        // update reserve
        if (xToY) {
            reserveX = reserveIn + amountIn;
            reserveY = reserveOut - amountOut;
        } else {
            reserveY = reserveIn + amountIn;
            reserveX = reserveOut - amountOut;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit Swap(msg.sender, to, tokenIn, amountIn, tokenOut, amountOut);
        emit Sync(reserveX, reserveY);
    }

        function _feeFactor() internal view returns (uint256) {
        uint256 _fee = fee;
        if (_fee >= FEE_DENOMINATOR) revert InvalidFee();
        return FEE_DENOMINATOR - _fee;
    }
}
