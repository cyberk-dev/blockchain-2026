// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FullMath} from "./libraries/FullMath.sol";

contract LPToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable tokenX;
    address public immutable tokenY;

    uint256 public x; // reserve of tokenX
    uint256 public y; // reserve of tokenY

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
            uint256 dyExpected = FullMath.mulDiv(dx, y, x);
            if (dyExpected > dy) {
                uint256 dxExpected = FullMath.mulDiv(dy, x, y);
                dx = dxExpected;
            } else {
                dy = dyExpected;
            }
            lp = _min(
                FullMath.mulDiv(dx, _totalSupply, x),
                FullMath.mulDiv(dy, _totalSupply, y)
            );
        }
        if (lp == 0) {
            //revert
        }

        IERC20(tokenX).safeTransferFrom(msg.sender, address(this), dx);
        IERC20(tokenY).safeTransferFrom(msg.sender, address(this), dy);
        _mint(to, lp);
        x += dx;
        y += dy;
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
        dx = FullMath.mulDiv(lp, x, _totalSupply);
        dy = FullMath.mulDiv(lp, y, _totalSupply);

        if (dx == 0 || dy == 0) {
            //revert
        }

        _burn(msg.sender, lp);
        x -= dx;
        y -= dy;

        IERC20(tokenX).safeTransfer(to, dx);
        IERC20(tokenY).safeTransfer(to, dy);
        //emit
    }

    function k() external view returns (uint256) {
        return x * y;
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
}
