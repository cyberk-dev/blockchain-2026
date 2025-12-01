// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IFactoryToken} from "./interfaces/ITokenFactory.sol";
import {IToken} from "./interfaces/IToken.sol";

contract TokenFactory is
    IFactoryToken,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    uint256 public constant TOKEN_CREATION_FEE = 0.0000001 ether;

    address public tokenBeaconAddress;
    mapping(address => TokenData) public createdTokens;
    address public feeReceiver;

    struct TokenData {
        address token;
        address beacon;
    }

    event TokenCreated(address indexed tokenAddress);

    error InsufficientFee();
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _tokenBeaconAddress,
        address _feeReceiver
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        tokenBeaconAddress = _tokenBeaconAddress;
        feeReceiver = _feeReceiver;
    }

    function createToken(
        string memory name,
        string memory symbol,
        address usdt_address
    ) external payable nonReentrant returns (address) {
        if (msg.value < TOKEN_CREATION_FEE) {
            revert InsufficientFee();
        }
        bytes memory tokenData = abi.encodeWithSelector(
            IToken.initialize.selector,
            name,
            symbol,
            usdt_address
        );

        BeaconProxy tokenProxy = new BeaconProxy(
            address(tokenBeaconAddress),
            tokenData
        );

        createdTokens[address(tokenProxy)] = TokenData({
            token: address(tokenProxy),
            beacon: address(tokenBeaconAddress)
        });

        (bool sent, ) = feeReceiver.call{value: msg.value}("");
        if (!sent) {
            revert TransferFailed();
        }
        emit TokenCreated(address(tokenProxy));
        return address(tokenProxy);
    }
}
