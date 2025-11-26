// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Simple UpgradeableBeacon implementation.
 *
 * This contract stores the address of an implementation contract and can be
 * upgraded by the owner. Used with BeaconProxy to create upgradeable proxies
 * that all point to the same implementation through this beacon.
 */
contract UpgradeableBeacon is IBeacon, Ownable {
    address private _implementation;

    event Upgraded(address indexed implementation);

    /**
     * @dev Sets the initial implementation address.
     */
    constructor(address implementation_) Ownable(msg.sender) {
        _setImplementation(implementation_);
    }

    /**
     * @dev Returns the current implementation address.
     */
    function implementation() public view virtual override returns (address) {
        return _implementation;
    }

    /**
     * @dev Upgrades the beacon to a new implementation.
     *
     * Emits an {Upgraded} event.
     *
     * Requirements:
     *
     * - msg.sender must be the owner of the contract.
     * - `newImplementation` must be a contract.
     */
    function upgradeTo(address newImplementation) public virtual onlyOwner {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @dev Sets the implementation contract address for this beacon
     */
    function _setImplementation(address newImplementation) private {
        require(
            newImplementation.code.length > 0,
            "UpgradeableBeacon: implementation is not a contract"
        );
        _implementation = newImplementation;
    }
}
