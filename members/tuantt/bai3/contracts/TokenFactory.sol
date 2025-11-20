// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IToken} from "./interfaces/IToken.sol";

contract TokenFactory is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    address public tokenBeaconAddress;
    mapping(address => TokenData) public createdTokens;

    struct TokenData {
        address token;
        address beacon;
    }

    event TokenCreated(address indexed tokenAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _tokenBeaconAddress) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        tokenBeaconAddress = _tokenBeaconAddress;
    }

    function createToken(
        string memory name,
        string memory symbol
    ) external nonReentrant returns (address) {
        bytes memory tokenData = abi.encodeWithSelector(
            IToken.initialize.selector,
            name,
            symbol
        );

        BeaconProxy tokenProxy = new BeaconProxy(
            address(tokenBeaconAddress),
            tokenData
        );

        createdTokens[address(tokenProxy)] = TokenData({
            token: address(tokenProxy),
            beacon: address(tokenBeaconAddress)
        });
        emit TokenCreated(address(tokenProxy));
        return address(tokenProxy);
    }
}
