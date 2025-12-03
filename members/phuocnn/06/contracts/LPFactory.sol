// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./core/LPTokenSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LPFactory {
    using SafeERC20 for IERC20;
    mapping(bytes32 => address) public pools;
    mapping(address => mapping(address => address)) public getPool;

    event PoolCreated(
        address indexed token0,
        address indexed token1,
        address indexed pool,
        uint256 amount0,
        uint256 amount1
    );

    function createPool(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) external returns (address pool) {
        require(token0 != token1, "LPFactory: Identical tokens");
        require(
            token0 != address(0) && token1 != address(0),
            "LPFactory: Zero address"
        );

        (address tokenA, address tokenB) = token0 < token1
            ? (token0, token1)
            : (token1, token0);
        require(
            getPool[tokenA][tokenB] == address(0),
            "LPFactory: Pool already exists"
        );

        LPTokenSwap newPool = new LPTokenSwap();
        pool = address(newPool);

        IERC20(token0).safeTransferFrom(msg.sender, pool, amount0);
        IERC20(token1).safeTransferFrom(msg.sender, pool, amount1);

        newPool.initialize(token0, token1, amount0, amount1, msg.sender);

        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB));
        pools[poolKey] = pool;
        getPool[tokenA][tokenB] = pool;
        getPool[tokenB][tokenA] = pool;

        emit PoolCreated(token0, token1, pool, amount0, amount1);
    }
}
