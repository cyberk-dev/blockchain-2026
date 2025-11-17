pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EventEmitter} from "./EventEmitter.sol";

contract EventEmitterV2 is EventEmitter {
    event Upgraded();

    function emitTokenCreated(
        address _token,
        address _creator,
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external override onlyPublisher {
        emit Upgraded();
        emit TokenCreated(_token, _creator, _name, _symbol, _initialSupply);
    }
}

