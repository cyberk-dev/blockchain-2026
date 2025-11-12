// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable, Pausable {
    error TransferPaused();

    constructor(string memory _name, string memory _symbol, uint256 _totalSupply) ERC20(_name, _symbol) Ownable(msg.sender) {
        _mint(msg.sender, _totalSupply);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20)
    {
        if(paused()) {
            revert TransferPaused();
        }
        super._update(from, to, amount);
    }

}