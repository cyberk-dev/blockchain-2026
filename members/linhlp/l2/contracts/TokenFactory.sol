pragma solidity ^0.8.28;

import {Token} from "./Token.sol";
import {EventEmitter} from "./EventEmitter.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    EventEmitter public eventEmitter;
    
    address[] public tokens;
    mapping(address => address) public tokenCreator;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, EventEmitter _eventEmitter) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(_owner);
        eventEmitter = _eventEmitter;
    }

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
        uint256 _price
    ) public returns (address) {
        Token newToken = new Token(_name, _symbol, _initialSupply);
        address tokenAddress = address(newToken);

        newToken.setPrice(_price);

        tokens.push(tokenAddress);
        tokenCreator[tokenAddress] = msg.sender;

        eventEmitter.emitTokenCreated(
            tokenAddress,
            msg.sender,
            _name,
            _symbol,
            _initialSupply
        );

        return tokenAddress;
    }

    function getTokenCreator(address _tokenAddress) public view returns (address) {
        return tokenCreator[_tokenAddress];
    }

    function getTokenCount() public view returns (uint256) {
        return tokens.length;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

