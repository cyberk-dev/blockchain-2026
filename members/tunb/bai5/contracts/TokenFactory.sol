// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Token} from "./Token.sol";

/**
 * @title TokenFactory
 * @notice Factory for deploying Token contracts with creation fee
 * @dev Collects fixed ETH fee on each token creation
 */
contract TokenFactory is Ownable, ReentrancyGuard {
    /// @notice Fixed fee in wei required to create a token
    uint256 public creationFee;

    /// @notice Address receiving creation fees
    address payable public feeRecipient;

    /// @notice Array of all deployed token addresses
    address[] public deployedTokens;

    /// @notice Emitted when a new token is created
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 creationFee
    );

    /// @notice Emitted when creation fee is updated
    event CreationFeeUpdated(uint256 newFee);

    /// @notice Emitted when fee recipient is updated
    event FeeRecipientUpdated(address indexed newRecipient);

    error InsufficientCreationFee(uint256 required, uint256 provided);
    error InvalidFeeRecipient();
    error TransferFailed();

    /**
     * @notice Initialize factory with fee configuration
     * @param creationFee_ Initial creation fee in wei
     * @param feeRecipient_ Address to receive fees
     */
    constructor(
        uint256 creationFee_,
        address payable feeRecipient_
    ) Ownable(msg.sender) {
        if (feeRecipient_ == address(0)) revert InvalidFeeRecipient();
        creationFee = creationFee_;
        feeRecipient = feeRecipient_;
    }

    /**
     * @notice Deploy a new Token contract
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param slope_ Bonding curve slope parameter (a)
     * @param initialPrice_ Bonding curve base price (b)
     * @param feeBps_ Transaction fee in basis points
     * @return tokenAddress Address of the deployed token
     */
    function createToken(
        string memory name_,
        string memory symbol_,
        uint256 slope_,
        uint256 initialPrice_,
        uint256 feeBps_
    ) external payable nonReentrant returns (address tokenAddress) {
        if (msg.value < creationFee) {
            revert InsufficientCreationFee(creationFee, msg.value);
        }

        // Deploy new Token contract
        Token token = new Token(
            name_,
            symbol_,
            slope_,
            initialPrice_,
            feeBps_,
            feeRecipient // Token fees go to same recipient
        );

        tokenAddress = address(token);

        // Transfer ownership to creator
        token.transferOwnership(msg.sender);

        // Track deployment
        deployedTokens.push(tokenAddress);

        // Emit event before external calls
        emit TokenCreated(tokenAddress, msg.sender, name_, symbol_, creationFee);

        // Transfer creation fee to recipient
        (bool feeSuccess, ) = feeRecipient.call{value: creationFee}("");
        if (!feeSuccess) revert TransferFailed();

        // Refund excess ETH
        uint256 excess = msg.value - creationFee;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}(
                ""
            );
            if (!refundSuccess) revert TransferFailed();
        }
    }

    /**
     * @notice Update creation fee
     * @param newFee New fee in wei
     */
    function setCreationFee(uint256 newFee) external onlyOwner {
        creationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }

    /**
     * @notice Update fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address payable newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /**
     * @notice Get total number of deployed tokens
     * @return count Number of tokens deployed
     */
    function getDeployedTokensCount() external view returns (uint256 count) {
        return deployedTokens.length;
    }

    /**
     * @notice Get all deployed token addresses
     * @return tokens Array of deployed token addresses
     */
    function getDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }
}
