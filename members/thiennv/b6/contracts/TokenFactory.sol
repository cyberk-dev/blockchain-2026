// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Token} from "./Token.sol";

contract TokenFactory {
    event TokenCreated(address indexed token);

    error InvalidPaymentToken();
    error InvalidTreasury();
    error SaleEnded();
    error InvalidFee();

    function create(
        string memory name,
        string memory symbol,
        address paymentToken,
        address treasury,
        uint256 endTime,
        uint256 slope,
        uint256 basePrice,
        uint256 feeBps
    ) external returns (address) {
        if (paymentToken == address(0)) revert InvalidPaymentToken();
        if (treasury == address(0)) revert InvalidTreasury();
        if (endTime <= block.timestamp) revert SaleEnded();

        Token token = new Token(
            name,
            symbol,
            paymentToken,
            treasury,
            endTime,
            slope,
            basePrice,
            feeBps
        );
        token.transferOwnership(msg.sender);

        address deployed = address(token);
        emit TokenCreated(deployed);
        return deployed;
    }
}
