// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Token.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

contract TokenFactoryV2 is UUPSUpgradeable, OwnableUpgradeable {
    mapping(address => bool) public exists;
    address implementation;

    event TokenDeployed(
        address indexed tokenAddress,
        string name,
        string symbol
    );

    event TokenDeployedV2(
        address indexed tokenAddress,
        string name,
        string symbol
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
        implementation = address(new Token());
    }

    function deployNewToken(
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialSupply
    ) external returns (address instance) {
        instance = Clones.clone(implementation);

        // Initialize the proxy with msg.sender as contractDeployer
        IToken(instance).initialize(tokenName, tokenSymbol, initialSupply);

        exists[instance] = true;

        emit TokenDeployedV2(instance, tokenName, tokenSymbol);
    }

    function version() public pure returns (uint256) {
        return 2;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
