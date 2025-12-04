// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/SwapMath.sol";

contract LPToken is ERC20 {
    using SafeERC20 for IERC20;
    using SwapMath for uint256;

    address public token0;
    address public token1;
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public k;
    address public factory;

    event LiquidityAdded(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 lpAmount
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 lpAmount
    );

    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );

    modifier onlyFactory() {
        require(msg.sender == factory, "LPToken: Only factory");
        _;
    }

    constructor() ERC20("Liquidity Provider Token", "LP") {
        factory = msg.sender;
    }

    function initialize(
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _amount1,
        address _to
    ) external onlyFactory {
        require(
            token0 == address(0) && token1 == address(0),
            "LPToken: Already initialized"
        );
        require(
            _token0 != address(0) && _token1 != address(0),
            "LPToken: Invalid token address"
        );
        require(_token0 != _token1, "LPToken: Identical tokens");
        require(_amount0 > 0 && _amount1 > 0, "LPToken: Invalid amounts");

        token0 = _token0;
        token1 = _token1;
        reserve0 = _amount0;
        reserve1 = _amount1;
        k = _amount0 * _amount1;

        require(
            IERC20(_token0).balanceOf(address(this)) >= _amount0,
            "LPToken: Insufficient token0"
        );
        require(
            IERC20(_token1).balanceOf(address(this)) >= _amount1,
            "LPToken: Insufficient token1"
        );

        uint256 lpAmount = _amount0 > _amount1 ? _amount0 : _amount1;
        _mint(_to, lpAmount);

        emit LiquidityAdded(_to, _amount0, _amount1, lpAmount);
    }

    function getReserves()
        external
        view
        returns (uint256 _reserve0, uint256 _reserve1)
    {
        return (reserve0, reserve1);
    }
}
