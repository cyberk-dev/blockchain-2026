// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./LPToken.sol";

contract LPFactory {
    mapping(address => mapping(address => address)) public getPool;
    
    address[] public allPools;

    error IdenticalTokens();
    error ZeroAddress();
    error PoolExists();

    function createPool(
        address tokenA,
        address tokenB
    ) external returns (address pool) {
        if (tokenA == tokenB) {
            revert IdenticalTokens();
        }

        if (tokenA == address(0) || tokenB == address(0)) {
            revert ZeroAddress();
        }

        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        if (getPool[token0][token1] != address(0)) {
            revert PoolExists();
        }

        LPToken newPool = new LPToken(token0, token1);
        pool = address(newPool);

        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool;

        allPools.push(pool);
    }

    function getPoolAddress(
        address tokenA,
        address tokenB
    ) external view returns (address pool) {
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        return getPool[token0][token1];
    }
}

