// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
    address[] public deployedTokens;
    mapping(address => address) public tokenCreators;
    mapping(address => address[]) public creatorTokens;

    uint256 public constant DEFAULT_SALE_DURATION = 1 hours;
    uint256 public constant DEFAULT_SLOPE = 0.0001 ether;
    uint256 public constant DEFAULT_STARTING_PRICE = 0.001 ether;

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 endTime,
        uint256 slope,
        uint256 startingPrice,
        address paymentToken
    );

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address paymentToken
    ) external returns (address tokenAddress) {
        return createTokenWithParams(
            name,
            symbol,
            initialSupply,
            block.timestamp + DEFAULT_SALE_DURATION,
            DEFAULT_SLOPE,
            DEFAULT_STARTING_PRICE,
            paymentToken
        );
    }

    function createTokenWithParams(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 endTime,
        uint256 slope,
        uint256 startingPrice,
        address paymentToken
    ) public returns (address tokenAddress) {
        require(bytes(name).length > 0, "TokenFactory: name cannot be empty");
        require(bytes(symbol).length > 0, "TokenFactory: symbol cannot be empty");
        require(initialSupply > 0, "TokenFactory: initial supply must be greater than 0");
        require(endTime > block.timestamp, "TokenFactory: end time must be in the future");
        require(startingPrice > 0, "TokenFactory: starting price must be greater than 0");
        require(paymentToken != address(0), "TokenFactory: payment token cannot be zero address");

        Token newToken = new Token(
            name,
            symbol,
            initialSupply,
            endTime,
            slope,
            startingPrice,
            paymentToken
        );
        tokenAddress = address(newToken);

        newToken.transfer(msg.sender, initialSupply);

        deployedTokens.push(tokenAddress);
        tokenCreators[tokenAddress] = msg.sender;
        creatorTokens[msg.sender].push(tokenAddress);

        emit TokenCreated(
            tokenAddress,
            msg.sender,
            name,
            symbol,
            initialSupply,
            endTime,
            slope,
            startingPrice,
            paymentToken
        );

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
