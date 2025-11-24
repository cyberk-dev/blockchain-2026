// ADD spx-erc20
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20 {
    using FullMath for uint256;

    uint256 public endtime;
    uint256 public tokenSold;
    uint256 public a; // slope of curve
    uint256 public b; // base price

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 initialSupply
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, initialSupply);

        endtime = block.timestamp + 1 hours;
        a = 0.0001 ether;
        b = 0.001 ether;
    }

    modifier onlyBeforeEnd() {
        require(block.timestamp < endtime, "Sale has ended");
        _;
    }

    function buyTokens(uint256 _amount) external payable onlyBeforeEnd {}

    function priceOf(uint256 tokenX) public view returns (uint256) {
        return a * tokenX + b;
    }

    function getCost(
        uint256 s,
        uint256 m,
        uint256 _a,
        uint256 _b
    ) public pure returns (uint256) {
        uint256 linearPart = _a.mulDiv(m * (2 * s + m + 1), 2);
        uint256 basePart = _b * m;
        return linearPart + basePart;
    }
}
