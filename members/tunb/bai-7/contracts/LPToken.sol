// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LPToken is ERC20 {
    IERC20 public immutable PEPE;
    IERC20 public immutable USDT;

    uint256 public constant FEE_RATE = 3; // 0.3% fee
    uint256 public constant FEE_DENOMINATOR = 1000;

    uint256 public reservePEPE;
    uint256 public reserveUSDT;

    uint256 public constant MINIMUM_LIQUIDITY = 10**3;

    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error SlippageExceeded();
    error InvalidTokens();
    error ZeroAmount();

    event LiquidityAdded(address indexed provider, uint256 amountPEPE, uint256 amountUSDT, uint256 lPToken);
    event LiquidityRemoved(address indexed provider, uint256 amountPEPE, uint256 amountUSDT, uint256 lPToken);
    event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);


    constructor(address _pepe, address _usdt, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        PEPE = IERC20(_pepe);
        USDT = IERC20(_usdt);
    }

    function addLiquidity(uint256 amountPEPE, uint256 amountUSDT) external returns (uint256 lpTokens)
    {
        if (amountPEPE == 0 || amountUSDT == 0) {
            revert ZeroAmount();
        }

        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0){
            lpTokens = sqrt(amountPEPE * amountUSDT);
            if (lpTokens <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            _mint(address(1), MINIMUM_LIQUIDITY); // lock the first MINIMUM_LIQUIDITY tokens
            lpTokens -= MINIMUM_LIQUIDITY;
        }
        else 
        {
            uint256 lpTokensPEPE = (amountPEPE * _totalSupply) / reservePEPE;
            uint256 lpTokensUSDT = (amountUSDT * _totalSupply) / reserveUSDT;
            lpTokens = lpTokensPEPE < lpTokensUSDT ? lpTokensPEPE : lpTokensUSDT;
        }

        if (lpTokens == 0) {
            revert InsufficientLiquidity();
        }

        PEPE.transferFrom(msg.sender, address(this), amountPEPE);
        USDT.transferFrom(msg.sender, address(this), amountUSDT);

        reservePEPE += amountPEPE;
        reserveUSDT += amountUSDT;

        _mint(msg.sender, lpTokens);
        emit LiquidityAdded(msg.sender, amountPEPE, amountUSDT, lpTokens);
    }

    function removeLiquidity(uint256 lpTokens) external returns (uint256 amountPEPE, uint256 amountUSDT) {
       if (lpTokens == 0) {
            revert ZeroAmount();
        }

        uint256 _totalSupply = totalSupply();

        amountPEPE = (lpTokens * reservePEPE) / _totalSupply;
        amountUSDT = (lpTokens * reserveUSDT) / _totalSupply;

        if (amountPEPE == 0 || amountUSDT == 0) {
            revert InsufficientLiquidity();
        }

        _burn(msg.sender, lpTokens);

        reservePEPE -= amountPEPE;
        reserveUSDT -= amountUSDT;

        PEPE.transfer(msg.sender, amountPEPE);
        USDT.transfer(msg.sender, amountUSDT);

        emit LiquidityRemoved(msg.sender, amountPEPE, amountUSDT, lpTokens);
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
