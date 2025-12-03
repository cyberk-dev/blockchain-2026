// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BondingCurveToken.sol";

contract TokenFactory {
    uint256 public creationFee;
    address public feeReceipt;

    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        address indexed creator
    );

    constructor(uint256 _creationFee, address _feeReceipt) {
        creationFee = _creationFee;
        feeReceipt = _feeReceipt;
    }

    // Exercise 5.2: Create Token with Fee
    function createToken(
        string memory name,
        string memory symbol,
        uint256 a,
        uint256 b,
        uint256 buyFeePercent
    ) external payable returns (address) {
        // Require fixed amount of native ETH
        require(msg.value >= creationFee, "Insufficient creation fee");

        // Transfer fee to fee_receipt
        (bool success, ) = feeReceipt.call{value: creationFee}("");
        require(success, "Fee transfer failed");

        // Deploy new token
        // We pass msg.sender as the owner so they can manage the token if needed
        BondingCurveToken newToken = new BondingCurveToken(
            name,
            symbol,
            a,
            b,
            feeReceipt,
            buyFeePercent,
            msg.sender
        );

        emit TokenCreated(address(newToken), name, symbol, msg.sender);

        // Refund excess ETH if user sent too much
        uint256 refund = msg.value - creationFee;
        if (refund > 0) {
            (bool successRefund, ) = msg.sender.call{value: refund}("");
            require(successRefund, "Refund failed");
        }

        return address(newToken);
    }
}
