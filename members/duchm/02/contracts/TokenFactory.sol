pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
  uint256 tokenCount = 0;
  mapping(address => Token) public tokenMap;

  event TokenCreated(address indexed tokenAddress, string name, string symbol, address owner);

    function createToken(string memory name, string memory symbol, uint256 initialSupply) public returns (address) {
      Token token = new Token(name, symbol, initialSupply, msg.sender);
      tokenMap[address(token)] = token;
      tokenCount++;
      emit TokenCreated(address(token), name, symbol, msg.sender);
      return address(token);
    }

    function getToken(address tokenAddress) public view returns (Token) {
      return tokenMap[tokenAddress];
    }

    function getTokenCount() public view returns (uint256) {
      return tokenCount;
    }
}