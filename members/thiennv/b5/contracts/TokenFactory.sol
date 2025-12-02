// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

/// @title Factory for deploying bonding curve tokens
/// @notice Tracks which tokens each owner has created and charges a creation fee
contract TokenFactory {
    address payable public immutable feeRecipient;
    uint256 public immutable creationFee;

    mapping(address => address[]) private _ownerTokens;

    event TokenCreated(address indexed owner, address token);
    error InvalidCreationFee();

    constructor(uint256 creationFee_) {
        feeRecipient = payable(msg.sender);
        creationFee = creationFee_;
    }

    /// @notice Deploy a new Token and transfer its ownership to the caller
    function createToken(
        string memory name,
        string memory symbol,
        uint256 endTime,
        uint256 slope,
        uint256 basePrice
    ) external payable returns (address token) {
        if (msg.value != creationFee) revert InvalidCreationFee();

        Token newToken = new Token(name, symbol, endTime, slope, basePrice);
        newToken.transferOwnership(msg.sender);

        token = address(newToken);
        _ownerTokens[msg.sender].push(token);

        (bool sent, ) = feeRecipient.call{value: msg.value}("");
        require(sent, "Fee transfer failed");

        emit TokenCreated(msg.sender, token);
    }

    /// @notice Return every token created by a specific owner
    function getTokens(address owner) external view returns (address[] memory) {
        return _ownerTokens[owner];
    }
}
