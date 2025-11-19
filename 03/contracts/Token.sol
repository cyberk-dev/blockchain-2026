pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public price; // per 1_0000000000000000 (decimals)

    uint256 public endTime;

    error InsufficientFunds();
    error InvalidAmount();

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) 
      ERC20(_name, _symbol) 
      Ownable(msg.sender)
    {
        price = 0.1 ether; // 1 * 10^17
        _mint(msg.sender, _initialSupply);
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function buyToken(uint256 _amount) external payable nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        if (msg.value.mulDivRoundingUp(10**decimals(), price) < _amount) revert InsufficientFunds();
        _mint(msg.sender, _amount);
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}