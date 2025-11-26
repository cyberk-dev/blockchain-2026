// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactory is Ownable {
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 slope,
        uint256 basePrice,
        address paymentToken
    );
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event BuyFeeBpsUpdated(uint256 oldBps, uint256 newBps);

    address[] public allTokens;
    mapping(address => address[]) public creatorToTokens;

    address public feeRecipient;
    uint256 public creationFee;
    uint256 public buyFeeBps; // basis points for buy fee, 100 = 1%

    error InsufficientCreationFee(uint256 sent, uint256 required);
    error TransferFailed();

    constructor(
        address _feeRecipient,
        uint256 _creationFee,
        uint256 _buyFeeBps
    ) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        creationFee = _creationFee;
        buyFeeBps = _buyFeeBps;
    }

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 slope,
        uint256 basePrice,
        address paymentToken
    ) external payable returns (address tokenAddress) {
        // Check creation fee
        if (msg.value < creationFee) {
            revert InsufficientCreationFee(msg.value, creationFee);
        }

        // Transfer fee to recipient
        if (creationFee > 0) {
            (bool success, ) = feeRecipient.call{value: creationFee}("");
            if (!success) revert TransferFailed();
        }

        // Refund excess ETH
        uint256 excess = msg.value - creationFee;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            if (!refundSuccess) revert TransferFailed();
        }

        Token token = new Token(
            name,
            symbol,
            initialSupply,
            slope,
            basePrice,
            paymentToken,
            feeRecipient,
            buyFeeBps
        );
        // At construction, Token mints to msg.sender (the factory). Move supply to creator.
        require(
            token.transfer(msg.sender, initialSupply),
            "Transfer to creator failed"
        );
        tokenAddress = address(token);
        allTokens.push(tokenAddress);
        creatorToTokens[msg.sender].push(tokenAddress);
        emit TokenCreated(
            tokenAddress,
            msg.sender,
            name,
            symbol,
            initialSupply,
            slope,
            basePrice,
            paymentToken
        );
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    function setCreationFee(uint256 _creationFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _creationFee;
        emit CreationFeeUpdated(oldFee, _creationFee);
    }

    function setBuyFeeBps(uint256 _buyFeeBps) external onlyOwner {
        uint256 oldBps = buyFeeBps;
        buyFeeBps = _buyFeeBps;
        emit BuyFeeBpsUpdated(oldBps, _buyFeeBps);
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    function getCreatorTokens(
        address creator
    ) external view returns (address[] memory) {
        return creatorToTokens[creator];
    }
}
