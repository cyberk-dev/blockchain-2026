// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Token} from "./Token.sol";

contract TokenFactory is Ownable, ReentrancyGuard {
    mapping(address => address) public createdTokens;
    address[] public allTokens;

    address public feeReceipt;
    uint256 public creationFee;
    uint256 public transactionFeePercentage; // Basis points (e.g., 100 = 1%)

    event TokenCreated(address indexed tokenAddress);
    event FeeConfigUpdated(address feeReceipt, uint256 creationFee, uint256 transactionFeePercentage);

    error InsufficientCreationFee();
    error FeeReceiptCannotBeZeroAddress();

    constructor(
        address _feeReceipt,
        uint256 _creationFee,
        uint256 _transactionFeePercentage
    ) Ownable(msg.sender) {
        if (_feeReceipt == address(0)) revert FeeReceiptCannotBeZeroAddress();
        feeReceipt = _feeReceipt;
        creationFee = _creationFee;
        transactionFeePercentage = _transactionFeePercentage;
    }

    function updateFeeConfig(
        address _feeReceipt,
        uint256 _creationFee,
        uint256 _transactionFeePercentage
    ) external onlyOwner {
        if (_feeReceipt == address(0)) revert FeeReceiptCannotBeZeroAddress();
        feeReceipt = _feeReceipt;
        creationFee = _creationFee;
        transactionFeePercentage = _transactionFeePercentage;
        emit FeeConfigUpdated(_feeReceipt, _creationFee, _transactionFeePercentage);
    }

    function createToken(
        string memory name,
        string memory symbol,
        address usdt_address
    ) external payable nonReentrant returns (address) {
        if (msg.value < creationFee) revert InsufficientCreationFee();

        // Transfer creation fee to feeReceipt
        (bool success, ) = feeReceipt.call{value: msg.value}("");
        require(success, "Fee transfer failed");

        Token newToken = new Token(
            name,
            symbol,
            usdt_address,
            feeReceipt,
            transactionFeePercentage
        );
        
        // Transfer ownership of the new token to the factory owner (or keep it as factory, or transfer to msg.sender)
        // Usually factory creates it for the user, so transfer to msg.sender
        newToken.transferOwnership(msg.sender);

        createdTokens[address(newToken)] = msg.sender;
        allTokens.push(address(newToken));
        
        emit TokenCreated(address(newToken));
        return address(newToken);
    }
}
