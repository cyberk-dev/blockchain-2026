// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IToken {
    function initialize(
        string memory name,
        string memory symbol,
        address owner
    ) external;
}
