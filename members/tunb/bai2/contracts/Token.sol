// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable
{ 
    uint256 TOKEN_PRICE = 0.1 ether; // Price per token in wei 0.1 = 1^17 wei
    constructor (string memory name_, string memory symbol_, uint256 initialSupply_) ERC20(name_, symbol_) Ownable(msg.sender) 
    {
        _mint(msg.sender, initialSupply_);
    }

    // amount in number of tokens (not in wei)
    // bt: y = ax + b bonding curve
    function buyTokens(uint256 amount) public payable 
    {
        if (amount == 0) revert ("Amount must be greater than zero");
        uint256 cost = msg.value * (10 ** decimals()) / TOKEN_PRICE;
        if (amount < cost) revert ("Insufficient Ether sent");
        _mint(msg.sender, amount);
    }
}