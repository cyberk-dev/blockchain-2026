pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {FullMath} from "./FullMath.sol";

contract Token is ERC20, Ownable, ReentrancyGuard {
    using FullMath for uint256;

    uint256 public price; // per 1_0000000000000000 (decimals) - deprecated, kept for compatibility

    uint256 public endTime;
    uint256 public a; // slope - rate of price increase
    uint256 public b; // starting price
    uint256 public tokensSold; // total tokens sold (in wei, 18 decimals)

    error InsufficientFunds();
    error InvalidAmount();
    error TimeLimitExceeded();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        price = 0.1 ether; // 1 * 10^17 - deprecated
        endTime = block.timestamp + 1 hours; // Set endTime to 1 hour after deployment
        // Set default values for progressive pricing: y = ax + b
        // a = 0.0001 ether per token (slope)
        // b = 0.1 ether (starting price)
        a = 0.0001 ether; // 1 * 10^14
        b = 0.1 ether; // 1 * 10^17
        tokensSold = 0;
        _mint(msg.sender, _initialSupply);
    }

    modifier onlyBeforeEndTime() {
        if (block.timestamp > endTime) revert TimeLimitExceeded();
        _;
    }

    function setPrice(uint256 _price) external onlyOwner {
        price = _price;
    }

    function setSlopeAndIntercept(uint256 _a, uint256 _b) external onlyOwner {
        a = _a;
        b = _b;
    }

    /**
     * @notice Calculate total cost for buying N tokens using progressive pricing formula y = ax + b
     * @param _amount Amount of tokens to buy (in wei, 18 decimals)
     * @return totalCost Total cost in wei
     *
     * Formula: Sum from S+1 to S+N of (a*x + b)
     * Where:
     * - S = tokensSold / 1e18 (number of tokens already sold)
     * - N = _amount / 1e18 (number of tokens to buy)
     *
     * Total cost = a * ((S+N)*(S+N+1) - S*(S+1)) / 2 + b * N
     */
    function calculateTotalCost(uint256 _amount) public view returns (uint256) {
        uint256 unit = 10 ** decimals(); // 1e18
        uint256 S = tokensSold / unit; // Number of tokens already sold
        uint256 N = _amount / unit; // Number of tokens to buy

        if (N == 0) return 0;

        // Calculate sum using arithmetic progression formula
        // Sum from S+1 to S+N = Sum(1 to S+N) - Sum(1 to S)
        // = (S+N)*(S+N+1)/2 - S*(S+1)/2
        // = ((S+N)*(S+N+1) - S*(S+1)) / 2

        uint256 SN = S + N;
        uint256 sum1 = FullMath.mulDiv(SN, SN + 1, 2); // (S+N)*(S+N+1)/2
        uint256 sum2 = FullMath.mulDiv(S, S + 1, 2); // S*(S+1)/2
        uint256 sumK = sum1 - sum2; // Sum of x from S+1 to S+N

        // Calculate costA = a * sumK
        uint256 costA = FullMath.mulDiv(a, sumK, 1);

        // Calculate costB = b * N
        uint256 costB = FullMath.mulDiv(b, N, 1);

        // Total cost = costA + costB
        return costA + costB;
    }

    function buyToken(
        uint256 _amount
    ) external payable nonReentrant onlyBeforeEndTime {
        if (_amount == 0) revert InvalidAmount();

        // Calculate total cost using progressive pricing formula
        uint256 totalCost = calculateTotalCost(_amount);

        if (msg.value < totalCost) revert InsufficientFunds();

        // Mint tokens to buyer
        _mint(msg.sender, _amount);

        // Update tokens sold
        tokensSold += _amount;

        // Refund excess payment
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            (bool success, ) = payable(msg.sender).call{value: excess}("");
            require(success, "Refund failed");
        }
    }

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
