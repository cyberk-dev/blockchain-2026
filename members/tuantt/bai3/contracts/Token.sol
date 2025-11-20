// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract Token is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Parameters for the price of a FULL token in wei: P(x) = slope * x + intercept
    uint256 public slope; // 'a'
    uint256 public intercept; // 'b'

    uint256 private constant DECIMAL_PRECISION = 1e18;
    uint256 private constant SLOPE_PRECISION = 1e36; // 1e18 (for slope) * 1e18 (for token decimals)

    error InsufficientPayment();
    error InsufficientContractBalance();
    error AmountCannotBeZero();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol
    ) external initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        slope = 0.000000001 ether;
        intercept = 0;
    }

    /**
     * @dev Calculates the ETH cost to buy a given amount of tokens.
     * Formula derived from integrating the price function:
     * cost = integral of (a*x/1e18 + b) / 1e18 dx from s to s+m
     * cost = a*m*(2s+m)/(2*1e36) + b*m/1e18
     */
    function getBuyPrice(uint256 amount) public view returns (uint256 cost) {
        uint256 s = totalSupply();
        uint256 m = amount;
        uint256 slopeCost = (slope * m * (2 * s + m)) / (2 * SLOPE_PRECISION);
        uint256 interceptCost = (intercept * m) / DECIMAL_PRECISION;
        return slopeCost + interceptCost;
    }

    function buyTokens(uint256 amount) external payable nonReentrant {
        if (amount == 0) revert AmountCannotBeZero();
        uint256 cost = getBuyPrice(amount);
        if (msg.value < cost) {
            revert InsufficientPayment();
        }

        _mint(msg.sender, amount);

        // Refund
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
    }
}
