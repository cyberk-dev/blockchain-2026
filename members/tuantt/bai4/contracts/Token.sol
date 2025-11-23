// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {FullMath} from "./libraries/FullMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Token is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public usdt;

    error InsufficientPayment();
    error InsufficientContractBalance();
    error AmountCannotBeZero();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address usdt_address
    ) external initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        usdt = IERC20(usdt_address);
    }

    function getCost(
        uint256 s, // current supply
        uint256 m, // amount to buy
        uint256 _a, // slope
        uint256 _b // intercept
    ) public pure returns (uint256) {
        return _a.mulDiv(m * (2 * s + m + 1), 2) + _b * m;
    }

    function buyTokens(uint256 amount, uint256 _slope, uint256 _intercept) external nonReentrant {
        if (amount == 0) revert AmountCannotBeZero();
        uint256 cost = getCost(totalSupply(), amount, _slope, _intercept);
        // Transfer USDT from buyer to this contract
        usdt.safeTransferFrom(msg.sender, address(this), cost);
        _mint(msg.sender, amount);
    }
}
