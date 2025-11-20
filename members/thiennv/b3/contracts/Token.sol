// ADD spx-erc20
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public endtime;
    uint256 public tokenSold;
    uint256 public a; // slope of curve
    uint256 public b; // base price

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 initialSupply
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, initialSupply);

        endtime = block.timestamp + 1 hours;
        a = 0.0001 ether;
        b = 0.001 ether;
    }

    modifier onlyBeforeEnd() {
        require(block.timestamp < endtime, "Sale has ended");
        _;
    }

    function buyTokens(uint256 _amount) external payable onlyBeforeEnd {}
}
