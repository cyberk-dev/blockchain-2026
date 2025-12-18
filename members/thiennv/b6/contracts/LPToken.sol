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

    address public immutable tokenX;
    address public immutable tokenY;

    uint256 public reserveX; // reserve of tokenX
    uint256 public reserveY; // reserve of tokenY
    // fee
    uint256 public fee = 30; // 0.3%
    uint256 public constant FEE_DENOMINATOR = 10000;

    bool private _locked;

    constructor(address tokenX_, address tokenY_) ERC20("LP Token", "LPT") {
        if (tokenX_ == address(0) || tokenY_ == address(0)) {
            // revert
        }
        tokenX = tokenX_;
        tokenY = tokenY_;
    }

    function addLiquidity(
        uint256 dx,
        uint256 dy,
        address to
    ) external nonReentrant returns (uint256 lp) {
        if (to == address(0)) {
            //revert
        }
        if (dx == 0 || dy == 0) {
            //revert
        }

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            lp = _sqrt(dx * dy);
        } else {
            uint256 dyExpected = (dx * reserveY) / reserveX;
            if (dyExpected > dy) {
                uint256 dxExpected = (dy * reserveX) / reserveY;
                dx = dxExpected;
            } else {
                dy = dyExpected;
            }
            lp = _min((dx * _totalSupply) / reserveX, (dy * _totalSupply) / reserveY);
        }
        if (lp == 0) {
            //revert
        }

        IERC20(tokenX).safeTransferFrom(msg.sender, address(this), dx);
        IERC20(tokenY).safeTransferFrom(msg.sender, address(this), dy);
        _mint(to, lp);
        reserveX += dx;
        reserveY += dy;
        // emit added
    }

    function removeLiquidity(
        uint256 lp,
        address to
    ) external nonReentrant returns (uint256 dx, uint256 dy) {
        if (to == address(0) || lp == 0) {
            //revert
        }

        uint256 _totalSupply = totalSupply();
        dx = (lp * reserveX) / _totalSupply;
        dy = (lp * reserveY) / _totalSupply;

        if (dx == 0 || dy == 0) {
            //revert
        }

        _burn(msg.sender, lp);
        reserveX -= dx;
        reserveY -= dy;

        IERC20(tokenX).safeTransfer(to, dx);
        IERC20(tokenY).safeTransfer(to, dy);
        //emit
    }

    function k() external view returns (uint256) {
        return reserveX * reserveY;
    }

    function _sqrt(uint256 value) internal pure returns (uint256 z) {
        if (value > 3) {
            z = value;
            uint256 temp = (value / 2) + 1;
            while (temp < z) {
                z = temp;
                temp = (value / temp + temp) / 2;
            }
        } else if (value != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function getAmoutOut(
        uint256 amountIn,
        address tokenIn,
        uint256 reserveIn, // reserveX
        uint256 reserveOut // reserveY
    ) external view returns (uint256 amountOut) {
        if (tokenIn != tokenX && tokenIn != tokenY) {
            //revert
        }
        if (amountIn == 0) {
            //revert
        }

        uint256 dx = amountIn * 997;
        //uint256 top = dx * reserveOut;
        uint256 bot = reserveIn * 1000 + dx;
        //amountOut = top / bot;
        amountOut = dx.mulDiv(reserveOut, bot);
    }

    function swapExactIn(
        address tokenIn,
        uint256 amountIn,
        address to
    ) external returns (uint256 amountOut) {
        uint256 reserveIn;
        uint256 reserveOut;
        bool xToY;

        if (tokenIn == tokenX) {
            reserveIn = reserveX;
            reserveOut = reserveY;
            xToY = true;
        } else {
            reserveIn = reserveY;
            reserveOut = reserveX;
            xToY = false;
        }

        amountOut = this.getAmoutOut(amountIn, tokenIn, reserveIn, reserveOut);

        // update reserve
        if (xToY) {
            reserveX = reserveIn + amountIn;
            reserveY = reserveOut - amountOut;
        } else {
            reserveY = reserveIn + amountIn;
            reserveX = reserveOut - amountOut;
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(xToY ? tokenY : tokenX).safeTransfer(to, amountOut);
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
    ) external view returns (uint256 amountIn) {
        if (tokenOut != tokenX && tokenOut != tokenY) {
            //revert
        }
        if (amountOut == 0) {
            //revert
        }

        // (reserveX+dx)*(reserveY - dy) = reserveX*reserveY
        // => reserveX*reserveY - reserveX*dy + dx*reserveY - dx*dy = reserveX*reserveY
        // => dx*reserveY - dx*dy = reserveX*dy
        // => dx*(reserveY - dy) = reserveX*dy
        // => dx = (reserveX*dy) / (reserveY - dy)

        // dxReal = dx / 0.997 = (reserveX * dy * 1000) / (997 * (reserveY - dy))

        uint256 top = reserveIn * amountOut * 1000;
        uint256 bot = (reserveOut - amountOut) * 997;
        amountIn = top.mulDiv(1, bot);
    }

    // swapExactOut
    function swapExactOut(
        address tokenOut,
        uint256 amountOut,
        address to
    ) external returns (uint256 amountIn) {
        uint256 reserveIn;
        uint256 reserveOut;
        bool xToY;

        if (tokenOut == tokenY) {
            reserveIn = reserveX;
            reserveOut = reserveY;
            xToY = true;
        } else {
            reserveIn = reserveY;
            reserveOut = reserveX;
            xToY = false;
        }

        amountIn = this.getAmoutIn(
            amountOut,
            tokenOut,
            reserveIn,
            reserveOut
        );

        // update reserve
        if (xToY) {
            reserveX = reserveIn + amountIn;
            reserveY = reserveOut - amountOut;
        } else {
            reserveY = reserveIn + amountIn;
            reserveX = reserveOut - amountOut;
        }

        IERC20(xToY ? tokenX : tokenY).safeTransferFrom(
            msg.sender,
            address(this),
            amountIn
        );
        IERC20(tokenOut).safeTransfer(to, amountOut);
    }
}
