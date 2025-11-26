// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {FullMath} from "./libraries/FullMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFactoryToken} from "./interfaces/ITokenFactory.sol";

contract Token is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    uint128 public constant FEE_PERCENTAGE = 500; // 5% fee
    uint128 public constant FEE_DENOMINATOR = 10000;

    IERC20 public usdt;
    IFactoryToken public factory;

    error InsufficientPayment();
    error InsufficientContractBalance();
    error AmountCannotBeZero();

    event TokensPurchased(
        address indexed buyer,
        uint256 amountSpent,
        uint256 tokensBought,
        uint256 fee
    );

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
        factory = IFactoryToken(msg.sender);
    }

    function getCost(
        uint256 s, // current supply
        uint256 m, // amount to buy
        uint256 _a, // slope
        uint256 _b // intercept
    ) public pure returns (uint256) {
        return _a.mulDiv(m * (2 * s + m + 1), 2) + _b * m;
    }

    function buyTokens(
        uint256 tokenAmount,
        uint256 _slope,
        uint256 _intercept
    ) external nonReentrant {
        if (tokenAmount == 0) revert AmountCannotBeZero();

        uint256 cost = getCost(totalSupply(), tokenAmount, _slope, _intercept);

        uint256 fee = cost.mulDivRoundingUp(FEE_PERCENTAGE, FEE_DENOMINATOR);

        uint256 totalPayment = cost + fee;

        usdt.safeTransferFrom(msg.sender, address(this), totalPayment);

        _mint(msg.sender, tokenAmount);

        usdt.safeTransfer(factory.feeReceiver(), fee);

        emit TokensPurchased(msg.sender, totalPayment, tokenAmount, fee);
    }
}
