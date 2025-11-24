// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Token} from "./Token.sol";

contract TokenFactory is Ownable, ReentrancyGuard {
    mapping(address => address) public createdTokens;
    address[] public allTokens;

    event TokenCreated(address indexed tokenAddress);

    constructor() Ownable(msg.sender) {}

    function createToken(
        string memory name,
        string memory symbol,
        address usdt_address
    ) external nonReentrant returns (address) {
        Token newToken = new Token(name, symbol, usdt_address);
        
        // Transfer ownership of the new token to the factory owner (or keep it as factory, or transfer to msg.sender)
        // Usually factory creates it for the user, so transfer to msg.sender
        newToken.transferOwnership(msg.sender);

        createdTokens[address(newToken)] = msg.sender;
        allTokens.push(address(newToken));
        
        emit TokenCreated(address(newToken));
        return address(newToken);
    }
}
