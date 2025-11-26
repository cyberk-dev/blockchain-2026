// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFactoryToken {
    function feeReceiver() external view returns (address);
}
