pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";  

contract TokenFactory is Ownable {

    event TokenCreated(address indexed tokenAddress, string name, string symbol, uint256 initialSupply);

    constructor() Ownable(msg.sender) {
    }

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external onlyOwner returns (address) {
        Token token = new Token(_name, _symbol, _initialSupply);
        emit TokenCreated(address(token), _name, _symbol, _initialSupply);
        return address(token);
    }
}