// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LPFactory is Ownable {
    using Strings for uint256;
    
    mapping(address => mapping(address => address)) public pairMapping;
    address[] public allPairs;

    constructor() Ownable(msg.sender) {}

    error PairExists(address tokenA, address tokenB);
    error DuplicateAddresses(address tokenA, address tokenB);
    error ZeroAddress();

    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair
    );

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair) {
        if (tokenA == tokenB) {
            revert DuplicateAddresses(tokenA, tokenB);
        }
        if (tokenA == address(0) || tokenB == address(0)) {
            revert ZeroAddress();
        }

        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        if (pairMapping[token0][token1] != address(0)) {
            revert PairExists(tokenA, tokenB);
        }
        string memory name = string(
            abi.encodePacked("LP-", allPairs.length.toString())
        );
        string memory symbol = string(
            abi.encodePacked("LP-", allPairs.length.toString())
        );

        Token lpToken = new Token(name, symbol, 0);
        pair = address(lpToken);
        pairMapping[token0][token1] = pair;
        pairMapping[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair);
    }

    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair) {
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        pair = pairMapping[token0][token1];
    }

    function getAllPairs() external view returns (address[] memory pairs) {
        pairs = allPairs;
    }
}
