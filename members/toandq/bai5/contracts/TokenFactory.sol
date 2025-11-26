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

    event TokensPurchased(
        address indexed tokenAddress,
        address indexed owner,
        string name,
        string symbol
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _beacon) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);

        implementation = address(new Token());
        beacon = _beacon;
    }

    function createToken(
        string memory tokenName,
        string memory tokenSymbol
    ) external returns (address instance) {
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

    function version() public pure returns (uint256) {
        return 1;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
