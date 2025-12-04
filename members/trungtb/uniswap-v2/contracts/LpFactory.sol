// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LPToken } from "./LpToken.sol";

contract LpFactory {
  mapping(address => mapping(address => address)) public getPairs;

  address[] public allPairs;

  event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint256 allPairsLength
    );

    // Errors
    error IdenticalTokens();
    error ZeroAddress();
    error PairExists();
    error PairCreationFailed();

    function createPair(address tokenA, address tokenB) external returns (address pair) {
      if (tokenA == tokenB) revert IdenticalTokens();
      if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();

      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      if (getPairs[token0][token1] != address(0)) revert PairExists();

      LPToken lpToken = new LPToken(token0, token1);
      pair = address(lpToken);

      getPairs[token0][token1] = pair;
      getPairs[token1][token0] = pair;

      allPairs.push(pair);

      emit PairCreated(token0, token1, pair, allPairs.length);
      return pair;
    }

    function getAllPairs() external view returns (address[] memory) {
      return allPairs;
    }

    function getPair(address tokenA, address tokenB) external view returns (address) {
      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      return getPairs[token0][token1];
    }
}