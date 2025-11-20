pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public tokenPrice;

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }

    function setPrice(uint256 _price) external onlyOwner {
        tokenPrice = _price;
    }

    function buy() external payable {
        require(msg.value > 0, "Insufficient funds");
        uint256 tokensToMint = (msg.value * 1 ether) / tokenPrice;
        _mint(msg.msg.sender, tokensToMint)
    }`
}


