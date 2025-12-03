// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract MockToken is ERC20, Ownable, ReentrancyGuard {
    constructor() ERC20("USDT Mock", "USDT") Ownable(msg.sender) {
        console.log("Deploying MockToken, deployer:", msg.sender);
        _mint(msg.sender, 100000000 ether);
        console.log("Mint completed");
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
