// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IPaymentToken {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract BondingCurve is ERC20, ERC20Burnable, Ownable {
    uint256 public constant a = 10 ** 22;
    uint256 public constant b = 12 * 10 ** 22;
    uint256 public constant SCALE = 10 ** 22;

    IPaymentToken public immutable paymentToken;

    event TokenBought(address indexed buyer, uint256 amount, uint256 cost);

    constructor(
        address _paymentToken
    ) ERC20("Bonding Curve Token", "BCT") Ownable(msg.sender) {
        paymentToken = IPaymentToken(_paymentToken);
    }

    function getCost(uint256 s, uint256 m) public pure returns (uint256) {
        // Using the formula for the sum of an arithmetic series
        // cost = m/2 * (2*price(s) + (m-1)*a)
        // price(s) = a*s + b
        // cost = m/2 * (2*(a*s + b) + (m-1)*a)
        // cost = m/2 * (2*a*s + 2*b + m*a - a)
        // cost = m * (a*s + b) + (m * (m-1) * a) / 2
        // To avoid precision loss, we scale up before division
        uint256 startPrice = a * s + b;
        uint256 sumOfPrices = m * startPrice + (m * (m - 1) * a) / 2;
        return sumOfPrices / SCALE;
    }

    function buyToken(uint256 amount) external {
        uint256 currentSupply = totalSupply();
        uint256 cost = getCost(currentSupply, amount);

        require(cost > 0, "Cost must be positive");

        bool success = paymentToken.transferFrom(
            msg.sender,
            address(this),
            cost
        );
        require(success, "Token transfer failed");

        _mint(msg.sender, amount);

        emit TokenBought(msg.sender, amount, cost);
    }
}
