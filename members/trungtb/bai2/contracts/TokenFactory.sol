// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./SimpleToken.sol";

contract TokenFactory {

  event TokenCreated(address indexed tokenAddress);

  function createToken(string memory _name, string memory _symbol, uint256 _initialSupply) public returns (address) {
    SimpleToken token = new SimpleToken(_name, _symbol, _initialSupply);
    emit TokenCreated(address(token));
    return address(token);
  }
}