// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Token.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";

contract TokenFactory is UUPSUpgradeable, OwnableUpgradeable {
    mapping(address => bool) public exists;
    address implementation;

    address beacon;

    uint256 public fee;
    address public fee_recipient;
    uint256 public recipient_fee_bps; // Basis points (10000 = 100%) - fee sent to fee_recipient

    event TokensPurchased(
        address indexed tokenAddress,
        address indexed owner,
        string name,
        string symbol
    );

    error InsufficientFee();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _beacon) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);

        implementation = address(new Token());
        beacon = _beacon;
        fee = 0.0001 ether;
        fee_recipient = msg.sender;
        recipient_fee_bps = 0; // Default: no BPS fee
    }

    function createToken(
        string memory tokenName,
        string memory tokenSymbol
    ) external payable returns (address instance) {
        if (msg.value < fee) revert InsufficientFee();

        // Calculate BPS fee for fee_recipient
        uint256 bpsFeeAmount = (msg.value * recipient_fee_bps) / 10000;

        // Transfer BPS fee to fee_recipient if applicable
        if (bpsFeeAmount > 0 && fee_recipient != address(0)) {
            (bool sent, ) = payable(fee_recipient).call{value: bpsFeeAmount}(
                ""
            );
            require(sent, "BPS fee transfer failed");
        }

        bytes memory data = abi.encodeWithSelector(
            IToken.initialize.selector,
            tokenName,
            tokenSymbol,
            msg.sender
        );
        BeaconProxy _beacon = new BeaconProxy(beacon, data);
        instance = address(_beacon);

        exists[instance] = true;

        emit TokensPurchased(instance, msg.sender, tokenName, tokenSymbol);
    }

    function setFee(uint256 _fee) external onlyOwner {
        fee = _fee;
    }

    function setFeeRecipient(address _fee_recipient) external onlyOwner {
        fee_recipient = _fee_recipient;
    }

    function setRecipientFeeBps(uint256 _recipient_fee_bps) external onlyOwner {
        require(_recipient_fee_bps <= 10000, "BPS cannot exceed 10000");
        recipient_fee_bps = _recipient_fee_bps;
    }

    function version() public pure returns (uint256) {
        return 1;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
