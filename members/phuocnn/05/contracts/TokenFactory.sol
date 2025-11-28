// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./BondingCurve.sol";

contract TokenFactory {
    uint256 public constant CREATION_FEE = 0.01 ether; // 0.01 ETH

    address payable public feeRecipient;

    address[] public deployedTokens;
    mapping(address => bool) public isDeployedToken;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        address paymentToken,
        uint256 fee
    );

    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    constructor(address payable _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    function createToken(
        string memory name,
        string memory symbol,
        address paymentToken
    ) external payable returns (address token) {
        require(msg.value >= CREATION_FEE, "Insufficient creation fee");
        require(paymentToken != address(0), "Invalid payment token");

        BondingCurve newToken = new BondingCurve(
            name,
            symbol,
            paymentToken,
            feeRecipient
        );

        token = address(newToken);

        deployedTokens.push(token);
        isDeployedToken[token] = true;

        (bool success, ) = feeRecipient.call{value: msg.value}("");
        require(success, "Fee transfer failed");

        emit TokenCreated(
            token,
            msg.sender,
            name,
            symbol,
            paymentToken,
            msg.value
        );

        return token;
    }

    function getDeployedTokensCount() external view returns (uint256) {
        return deployedTokens.length;
    }

    function getDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function setFeeRecipient(address payable newRecipient) external {
        require(msg.sender == feeRecipient, "Only fee recipient can update");
        require(newRecipient != address(0), "Invalid address");

        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;

        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }
}
