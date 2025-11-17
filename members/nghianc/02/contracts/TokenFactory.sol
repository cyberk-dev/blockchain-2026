// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
    // Array to store all deployed token addresses
    address[] public deployedTokens;

    // Mapping from token address to creator address
    mapping(address => address) public tokenCreators;

    // Mapping from creator to their deployed tokens
    mapping(address => address[]) public creatorTokens;

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address tokenAddress) {
        // Validate input parameters
        require(bytes(name).length > 0, "TokenFactory: name cannot be empty");
        require(bytes(symbol).length > 0, "TokenFactory: symbol cannot be empty");
        require(initialSupply > 0, "TokenFactory: initial supply must be greater than 0");

        // Deploy new token contract
        Token newToken = new Token(name, symbol, initialSupply);
        tokenAddress = address(newToken);

        // Transfer all tokens to the creator
        newToken.transfer(msg.sender, initialSupply);

        // Store token information
        deployedTokens.push(tokenAddress);
        tokenCreators[tokenAddress] = msg.sender;
        creatorTokens[msg.sender].push(tokenAddress);

        // Emit event
        emit TokenCreated(tokenAddress, msg.sender, name, symbol, initialSupply);

        return tokenAddress;
    }

    function getDeployedTokensCount() external view returns (uint256) {
        return deployedTokens.length;
    }

    function getAllDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getTokenCreator(address tokenAddress) external view returns (address) {
        return tokenCreators[tokenAddress];
    }

    function isTokenFromFactory(address tokenAddress) external view returns (bool) {
        return tokenCreators[tokenAddress] != address(0);
    }
}
