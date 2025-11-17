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
        Token newToken = new Token(name, symbol, totalSupply);
        address tokenAddress = address(newToken);

        emit TokenCreated(tokenAddress, name, symbol, totalSupply, msg.sender);

        return tokenAddress;
    }
}
