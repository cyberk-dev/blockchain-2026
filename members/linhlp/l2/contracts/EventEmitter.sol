pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract EventEmitter is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );

    mapping(address => bool) public publishers;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(_owner);
    }

    modifier onlyPublisher() {
        require(publishers[msg.sender], "EventEmitter: caller is not a publisher");
        _;
    }

    function registerPublisher(address _publisher) external onlyOwner {
        publishers[_publisher] = true;
    }

    function unregisterPublisher(address _publisher) external onlyOwner {
        publishers[_publisher] = false;
    }

    function emitTokenCreated(
        address _token,
        address _creator,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external virtual onlyPublisher {
        emit TokenCreated(_token, _creator, _name, _symbol, _initialSupply);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

