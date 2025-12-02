// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

/// @title Bonding curve token sale
/// @notice Buyers pay with native ETH following a linear bonding curve y = a*x + b
contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public immutable endTime;
    uint256 public slope; // a
    uint256 public basePrice; // b
    uint256 public tokensSold;
    uint256 public immutable scale; // pricing scale, defaults to 1e22

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event CurveUpdated(uint256 newSlope, uint256 newBasePrice);

    error InvalidAmount();
    error SaleEnded();
    error NotEnoughFunds();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 endTime_,
        uint256 slope_,
        uint256 basePrice_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (endTime_ <= block.timestamp) revert SaleEnded();

        endTime = endTime_;
        slope = slope_;
        basePrice = basePrice_;
        tokensSold = 0;
        scale = 10 ** 22;
    }

    modifier saleActive() {
        if (block.timestamp > endTime) revert SaleEnded();
        _;
    }

    function updateCurve(uint256 newSlope, uint256 newBasePrice) external onlyOwner {
        slope = newSlope;
        basePrice = newBasePrice;
        emit CurveUpdated(newSlope, newBasePrice);
    }

    /// @notice Preview total cost for buying `amountToBuy` using pricing scale
    function getCost(uint256 soldAmount, uint256 amountToBuy) public view returns (uint256) {
        if (amountToBuy == 0) return 0;

        uint256 s = soldAmount;
        uint256 m = amountToBuy;

        // linearPart = slope * m(2s + m + 1) / 2 / scale
        uint256 progression = m.mulDiv(2 * s + m + 1, 1);
        uint256 linearPart = slope.mulDiv(progression, 2 * scale);

        // basePart = basePrice * m / scale
        uint256 basePart = basePrice.mulDiv(m, scale);

        return linearPart + basePart;
    }

    /// @notice Buy `amount` tokens using the bonding curve pricing
    function buy(uint256 amount) external payable saleActive nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 cost = getCost(tokensSold, amount);
        if (msg.value < cost) revert NotEnoughFunds();

        tokensSold += amount;
        _mint(msg.sender, amount);
        emit TokensPurchased(msg.sender, amount, cost);

        uint256 refund = msg.value - cost;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "Refund failed");
        }
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
