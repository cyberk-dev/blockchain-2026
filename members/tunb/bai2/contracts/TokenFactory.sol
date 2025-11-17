pragma solidity ^0.8.28;

import { Token } from "./Token.sol";

contract TokenFactory {
    event TokenCreated(address tokenAddress, string name, string symbol, uint256 totalSupply);

    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) external returns (address) {
        Token newToken = new Token(name, symbol, totalSupply);
        emit TokenCreated(address(newToken), name, symbol, totalSupply);
        return address(newToken);
    }
}