// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IToken {
    function initialize(string memory name, string memory symbol) external;
    function setMinter(address minter) external;
    function owner() external view returns (address);
    function mintTokens(address _to, uint256 _amount) external;
    function burn(uint256 amount) external;
}
