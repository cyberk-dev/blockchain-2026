// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenFactory is Ownable, ReentrancyGuard {
    uint256 public creationFee;
    uint256 public buyFeePercent;
    address public feeRecipient;
    address public paymentToken;


    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol
    );
    event CreationFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);

    error InsufficientCreationFee();
    error InvalidFeeRecipient();
    error FeeTransferFailed();

    constructor(uint256 _creationFee, address _feeRecipient, address _paymentToken, uint256 _buyFeePercent) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        creationFee = _creationFee;
        feeRecipient = _feeRecipient;
        paymentToken = _paymentToken;
        buyFeePercent = _buyFeePercent;
    }

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _a,
        uint256 _b,
        uint256 _duration
    ) external payable nonReentrant returns (address) {
        if (msg.value < creationFee) revert InsufficientCreationFee();

        uint256 _endTime = block.timestamp + _duration;
        Token token = new Token(_name, _symbol, _a, _b, paymentToken, _endTime, buyFeePercent, feeRecipient);
        token.transferOwnership(msg.sender);

        (bool success, ) = feeRecipient.call{value: msg.value}("");
        if (!success) revert FeeTransferFailed();

        emit TokenCreated(address(token), msg.sender, _name, _symbol);
        return address(token);
    }

    function setCreationFee(uint256 _newFee) external onlyOwner {
        creationFee = _newFee;
        emit CreationFeeUpdated(_newFee);
    }

    function setFeeRecipient(address _newRecipient) external onlyOwner {
        if (_newRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(_newRecipient);
    }
} 
