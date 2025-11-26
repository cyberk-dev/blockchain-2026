// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";

contract TokenFactory is AccessControlDefaultAdminRules {
    bytes32 public constant TOKEN_CREATOR_ROLE =
        keccak256("TOKEN_CREATOR_ROLE");
    uint256 public constant CREATION_FEE = 0.0001 ether;

    event TokenCreated(
        address indexed token,
        string name,
        string symbol,
        address paymentToken,
        uint256 initialSupply,
        uint256 endTime,
        uint256 a,
        uint256 b,
        uint256 scale
    );

    address[] public allTokens;
    address public feeRecipient;

    constructor(
        address _feeRecipient
    ) AccessControlDefaultAdminRules(1 days, msg.sender) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        _grantRole(TOKEN_CREATOR_ROLE, msg.sender);
    }

    function setFeeRecipient(
        address _newRecipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _newRecipient;
    }

    function createToken(
        string memory name,
        string memory symbol,
        address paymentToken,
        uint256 initialSupply,
        uint256 endTime,
        uint256 a,
        uint256 b,
        uint256 scale
    ) external payable onlyRole(TOKEN_CREATOR_ROLE) returns (address) {
        require(msg.value == CREATION_FEE, "Invalid ETH amount");

        (bool sent, ) = payable(feeRecipient).call{value: msg.value}("");
        require(sent, "Fee transfer failed");

        Token token = new Token(
            name,
            symbol,
            paymentToken,
            initialSupply,
            endTime,
            a,
            b,
            scale
        );

        allTokens.push(address(token));

        emit TokenCreated(
            address(token),
            name,
            symbol,
            paymentToken,
            initialSupply,
            endTime,
            a,
            b,
            scale
        );

        return address(token);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
}
