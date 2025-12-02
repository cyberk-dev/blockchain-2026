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
        uint256 scale,
        address feeRecipient
    );

    address[] public allTokens;
    address public feeRecipient = address(0x887ad2b33ACCAe95fEE6CA7caFD66D312Dc4ad5E);

    constructor(
        address _feeRecipient
    ) AccessControlDefaultAdminRules(1 days, msg.sender) {
        if (_feeRecipient != feeRecipient) revert("Invalid fee recipient");
        feeRecipient = _feeRecipient;
        _grantRole(TOKEN_CREATOR_ROLE, msg.sender);
    }

    function createToken(
        string memory name,
        string memory symbol,
        address paymentToken,
        uint256 initialSupply,
        uint256 endTime,
        uint256 a,
        uint256 b,
        uint256 scale,
        address _feeRecipient
    ) external payable onlyRole(TOKEN_CREATOR_ROLE) returns (address) {
        if (msg.value != CREATION_FEE) revert("Invalid ETH amount");

        (bool sent, ) = payable(_feeRecipient).call{value: msg.value}("");

        if (!sent) revert("Fee transfer failed");

        Token token = new Token(
            name,
            symbol,
            paymentToken,
            initialSupply,
            endTime,
            a,
            b,
            scale,
            _feeRecipient
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
            scale,
            _feeRecipient
        );

        return address(token);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
}
