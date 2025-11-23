// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";
import {SimpleBondingCurve} from "./curves/SimpleBondingCurve.sol";

/// @title USDT
/// @author Toan DQ
/// @notice USDT is a token that is used to buy tokens
contract USDT is ERC20, Ownable, ReentrancyGuard {
    constructor() ERC20("Tether", "USDT") Ownable(msg.sender) {}
}
