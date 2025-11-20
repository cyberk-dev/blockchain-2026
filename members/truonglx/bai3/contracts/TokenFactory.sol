// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 totalSupply,
        address creator
    );

    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) external returns (address) {
        // Deploy new Token contract directly
        Token token = new Token(name, symbol, totalSupply);
        address tokenAddress = address(token);

        emit TokenCreated(tokenAddress, name, symbol, totalSupply, msg.sender);

        return tokenAddress;
    }
}
