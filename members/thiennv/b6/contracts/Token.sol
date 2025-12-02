// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./libraries/FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    address public immutable treasury;
    uint256 public immutable endTime;
    uint256 public immutable feeBps;
    uint256 public slope; // a
    uint256 public basePrice; // b
    uint256 public tokensSold; // counted in whole token units
    uint256 public immutable scale; // pricing scale, defaults to 1
    uint256 private constant TOKEN_UNIT = 10 ** 18;

    event Purchased(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 feePaid,
        address indexed seller
    );
    event CurveUpdated(uint256 newSlope, uint256 newBasePrice);

    error InvalidAmount();
    error SaleEnded();
    error NotEnoughFunds();
    error InsufficientAllowance();
    error InvalidPaymentToken();
    error InvalidTreasury();
    error InvalidFee();

    constructor(
        string memory name_,
        string memory symbol_,
        address paymentToken_,
        address treasury_,
        uint256 endTime_,
        uint256 slope_,
        uint256 basePrice_,
        uint256 feeBps_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (paymentToken_ == address(0)) revert InvalidPaymentToken();
        if (treasury_ == address(0)) revert InvalidTreasury();
        if (endTime_ <= block.timestamp) revert SaleEnded();

        paymentToken = IERC20(paymentToken_);
        treasury = treasury_;
        endTime = endTime_;
        feeBps = feeBps_;
        slope = slope_;
        basePrice = basePrice_;
        tokensSold = 0;
        scale = 10 ** 22;
    }

    modifier saleActive() {
        if (block.timestamp > endTime) revert SaleEnded();
        _;
    }

    function getCost(
        uint256 soldAmount,
        uint256 amountToBuy
    ) public view returns (uint256) {
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

    function buy(uint256 amount) external saleActive nonReentrant {
        if (amount == 0) revert InvalidAmount();

        uint256 cost = getCost(tokensSold, amount);

        uint256 balance = paymentToken.balanceOf(msg.sender);
        if (balance < cost) revert NotEnoughFunds();
        if (paymentToken.allowance(msg.sender, address(this)) < cost)
            revert InsufficientAllowance();

        tokensSold += amount;
        uint256 mintAmount = amount * TOKEN_UNIT;
        _mint(msg.sender, mintAmount);

        uint256 fee = cost.mulDiv(feeBps, 10_000);
        uint256 proceeds = cost - fee;

        if (fee > 0) {
            paymentToken.safeTransferFrom(msg.sender, treasury, fee);
        }
        if (proceeds > 0) {
            paymentToken.safeTransferFrom(msg.sender, owner(), proceeds);
        }

        emit Purchased(msg.sender, amount, cost, fee, owner());
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
