// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "../tokens/LPToken.sol";

contract LPFactory {
    mapping(address => mapping(address => address)) public lpPairs;

    event LPCreated(
        address indexed lp,
        address indexed token0,
        address indexed token1
    );

    error IdenticalAddresses();
    error ZeroAddress();
    error LPExisted();

    function createLP(
        address tokenA,
        address tokenB
    ) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalAddresses();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        if (lpPairs[tokenA][tokenB] != address(0)) revert LPExisted();

        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        LPToken lpToken = new LPToken(token0, token1);
        pair = address(lpToken);

        lpPairs[token0][token1] = pair;
        lpPairs[token1][token0] = pair;

        emit LPCreated(pair, token0, token1);
    }
}
