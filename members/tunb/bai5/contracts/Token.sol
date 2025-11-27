// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

/**
 * @title Token with Linear Bonding Curve
 * @notice ERC20 token with linear bonding curve pricing: y = ax + b
 * @dev Cost formula derived from integral: Cost(s, m) = m*(1 + 2ab + m + 2s) / (2a)
 *      where s = current supply, m = tokens to buy, a = slope, b = initialPrice
 *      WolframAlpha proof: https://www.wolframalpha.com/input?i=integral+of+x%2Fa+%2B+b+from+s+to+s%2Bm
 */
contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Price slope parameter (a) - higher = slower price increase
    uint256 public slope;

    /// @notice Initial/base price parameter (b) in wei
    uint256 public initialPrice;

    /// @notice Total tokens sold through bonding curve (simple units, not wei)
    uint256 public totalSold;

    /// @notice Transaction fee in basis points (500 = 5%)
    uint256 public feeBps;

    /// @notice Address receiving fees
    address payable public feeRecipient;

    /// @notice Emitted when tokens are purchased
    event TokensPurchased(
        address indexed buyer,
        uint256 tokenAmount,
        uint256 ethPaid,
        uint256 feeAmount
    );

    /// @notice Emitted when fee recipient is updated
    event FeeRecipientUpdated(address indexed newRecipient);

    /// @notice Emitted when fee BPS is updated
    event FeeBpsUpdated(uint256 newFeeBps);

    error AmountZero();
    error InsufficientPayment(uint256 required, uint256 provided);
    error InvalidFeeRecipient();
    error InvalidFeeBps();
    error TransferFailed();

    /**
     * @notice Initialize token with bonding curve parameters
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param slope_ Price slope (a) - higher value = slower price increase
     * @param initialPrice_ Base price (b) in wei
     * @param feeBps_ Transaction fee in basis points
     * @param feeRecipient_ Address to receive fees
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 slope_,
        uint256 initialPrice_,
        uint256 feeBps_,
        address payable feeRecipient_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (feeRecipient_ == address(0)) revert InvalidFeeRecipient();
        if (feeBps_ > BPS_DENOMINATOR) revert InvalidFeeBps();

        slope = slope_;
        initialPrice = initialPrice_;
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /**
     * @notice Calculate cost for buying tokens using bonding curve integral
     * @dev Formula: cost(s,m) = m*(1 + 2ab + m + 2s) / (2a)
     *      Derived from integral of linear curve y = x/a + b
     * @param tokenAmount Number of tokens to buy (m) - simple units
     * @param currentSupply Current sold supply (s) - simple units
     * @return cost Total cost in wei (rounded up)
     */
    function calculateCost(
        uint256 tokenAmount,
        uint256 currentSupply
    ) public view returns (uint256 cost) {
        if (tokenAmount == 0) return 0;

        // cost = m * (1 + 2*a*b + m + 2*s) / (2*a)
        uint256 numerator = tokenAmount *
            (1 + (2 * slope * initialPrice) + tokenAmount + (2 * currentSupply));
        uint256 denominator = 2 * slope;

        cost = numerator.mulDivRoundingUp(1, denominator);
    }

    /**
     * @notice Buy tokens with ETH, paying bonding curve price + fee
     * @param tokenAmount Number of tokens to purchase (simple units, e.g., 1, 5, 100)
     */
    function buyToken(uint256 tokenAmount) external payable nonReentrant {
        if (tokenAmount == 0) revert AmountZero();

        // Calculate cost and fee
        uint256 cost = calculateCost(tokenAmount, totalSold);
        uint256 fee = (cost * feeBps) / BPS_DENOMINATOR;
        uint256 totalRequired = cost + fee;

        if (msg.value < totalRequired) {
            revert InsufficientPayment(totalRequired, msg.value);
        }

        // Effects: update state before external calls
        totalSold += tokenAmount;

        // Mint tokens (tokenAmount * 10^decimals for ERC20 balance)
        uint256 mintAmount = tokenAmount * 10 ** decimals();
        _mint(msg.sender, mintAmount);

        // Emit event
        emit TokensPurchased(msg.sender, tokenAmount, msg.value, fee);

        // Interactions: external calls last (checks-effects-interactions)
        // Transfer fee to recipient
        if (fee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        // Refund excess ETH
        uint256 excess = msg.value - totalRequired;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}(
                ""
            );
            if (!refundSuccess) revert TransferFailed();
        }
    }

    /**
     * @notice Update fee recipient address
     * @param newRecipient New fee recipient
     */
    function setFeeRecipient(address payable newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /**
     * @notice Update transaction fee percentage
     * @param newFeeBps New fee in basis points
     */
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > BPS_DENOMINATOR) revert InvalidFeeBps();
        feeBps = newFeeBps;
        emit FeeBpsUpdated(newFeeBps);
    }
}
