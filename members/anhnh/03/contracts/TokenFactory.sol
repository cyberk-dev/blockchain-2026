// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 initialSupply);

    address[] public allTokens;
    mapping(address => address[]) public creatorToTokens;

    function createToken(string memory name, string memory symbol, uint256 initialSupply) external returns (address tokenAddress) {
        Token token = new Token(name, symbol, initialSupply);
        // At construction, Token mints to msg.sender (the factory). Move supply to creator.
        require(token.transfer(msg.sender, initialSupply), "Transfer to creator failed");
        tokenAddress = address(token);
        allTokens.push(tokenAddress);
        creatorToTokens[msg.sender].push(tokenAddress);
        emit TokenCreated(tokenAddress, msg.sender, name, symbol, initialSupply);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getCreatorTokens(address creator) external view returns (address[] memory) {
        return creatorToTokens[creator];
    }
}


