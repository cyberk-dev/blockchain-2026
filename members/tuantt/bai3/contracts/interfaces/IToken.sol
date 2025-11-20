// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IToken {
    function initialize(string memory name, string memory symbol) external;
    function owner() external view returns (address);
    function buyTokens(uint256 amount) external payable;
}
