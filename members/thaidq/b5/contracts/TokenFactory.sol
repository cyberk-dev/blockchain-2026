// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Token} from "./Token.sol";

contract TokenFactory is Ownable, ReentrancyGuard {
    address public feeReceipt;
    uint256 public creationFee; // Fixed amount of native ETH required to create a token

    address[] public deployedTokens;
    mapping(address => address) public tokenCreators;
    mapping(address => address[]) public creatorTokens;

    error InsufficientCreationFee();
    error InvalidFeeReceipt();

    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 slope,
        uint256 basePrice
    );
    event FeeReceiptUpdated(
        address indexed oldReceipt,
        address indexed newReceipt
    );
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address _feeReceipt, uint256 _creationFee) Ownable(msg.sender) {
        if (_feeReceipt == address(0)) revert InvalidFeeReceipt();
        feeReceipt = _feeReceipt;
        creationFee = _creationFee;
    }

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 slope,
        uint256 basePrice
    ) external payable nonReentrant returns (address tokenAddress) {
        // Check creation fee
        if (msg.value < creationFee) revert InsufficientCreationFee();

        // Deploy new token contract
        // Fee percentage: 100 = 1% (in basis points)
        Token newToken = new Token(
            name,
            symbol,
            initialSupply,
            slope,
            basePrice,
            feeReceipt,
            100 // 1% transaction fee
        );
        tokenAddress = address(newToken);

        // Transfer creation fee to fee receipt
        payable(feeReceipt).transfer(creationFee);

        // Refund excess ETH if any
        if (msg.value > creationFee) {
            payable(msg.sender).transfer(msg.value - creationFee);
        }

        // Store token information
        deployedTokens.push(tokenAddress);
        tokenCreators[tokenAddress] = msg.sender;
        creatorTokens[msg.sender].push(tokenAddress);

        // Emit event
        emit TokenCreated(
            tokenAddress,
            msg.sender,
            name,
            symbol,
            initialSupply,
            slope,
            basePrice
        );

        return tokenAddress;
    }

    function setFeeReceipt(address _feeReceipt) external onlyOwner {
        if (_feeReceipt == address(0)) revert InvalidFeeReceipt();
        address oldReceipt = feeReceipt;
        feeReceipt = _feeReceipt;
        emit FeeReceiptUpdated(oldReceipt, _feeReceipt);
    }

    function setCreationFee(uint256 _creationFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _creationFee;
        emit CreationFeeUpdated(oldFee, _creationFee);
    }

    function getDeployedTokensCount() external view returns (uint256) {
        return deployedTokens.length;
    }

    function getAllDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function getTokensByCreator(
        address creator
    ) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    function getTokenCreator(
        address tokenAddress
    ) external view returns (address) {
        return tokenCreators[tokenAddress];
    }

    function isTokenFromFactory(
        address tokenAddress
    ) external view returns (bool) {
        return tokenCreators[tokenAddress] != address(0);
    }
}
