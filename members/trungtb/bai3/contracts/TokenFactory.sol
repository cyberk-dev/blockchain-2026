// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import { AccessControlDefaultAdminRules } from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract TokenFactory is AccessControlDefaultAdminRules {
  bytes32 constant TOKEN_CREATOR_ROLE = keccak256('TOKEN_CREATOR_ROLE');

  event TokenCreated(address token, string name, string symbol, uint256 supply);

  address[] public tokens;

  constructor() AccessControlDefaultAdminRules(1 days, msg.sender) {
    _grantRole(TOKEN_CREATOR_ROLE, msg.sender);
  }

  function createToken(string memory _name, string memory _symbol, uint256 _initialSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
    address token = address(new Token(_name, _symbol, _initialSupply));
    tokens.push(token);
    emit TokenCreated(token, _name, _symbol, _initialSupply);
  }
}