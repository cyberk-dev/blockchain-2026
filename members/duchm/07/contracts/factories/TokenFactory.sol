pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../tokens/Token.sol";

contract TokenFactory is UUPSUpgradeable, OwnableUpgradeable {
    uint256 public creationFee;
    uint256 public buyFee;
    address public feeReceipt;
    address public paymentToken;
    uint256 public slope;
    uint256 public basePrice;

    event TokenCreated(address indexed token, address indexed owner);

    error InsufficientFee();
    error FeeTransferFailed();

    // @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
      address _feeReceipt,
      uint256 _creationFee,
      uint256 _buyFee,
      IERC20 _paymentToken,
      uint256 _slope,
      uint256 _basePrice
    ) public initializer {
      __UUPSUpgradeable_init();
      __Ownable_init(msg.sender);
      feeReceipt = _feeReceipt;
      creationFee = _creationFee;
      buyFee = _buyFee;
      paymentToken = address(_paymentToken);
      slope = _slope;
      basePrice = _basePrice;
    }

    function createToken(
        string memory name,
        string memory symbol
    ) public payable {
        if (msg.value < creationFee) revert InsufficientFee();
        (bool success, ) = feeReceipt.call{value: msg.value}("");
        if (!success) revert FeeTransferFailed();
        Token token = new Token(name, symbol, IERC20(paymentToken), slope, basePrice, feeReceipt, buyFee);
        token.transferOwnership(msg.sender);
        emit TokenCreated(address(token), msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override {}
}