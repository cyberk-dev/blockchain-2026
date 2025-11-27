// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Token} from "./Token.sol";

contract TokenFactory is Ownable {
  uint256 public creationFee;
  address public feeReceipt;
  uint256 public buyTokenFeePercentage;

  error InsufficientCreationFee();
  error FailedToSendFee();
  error FailedToRefund();

  event TokenCreated(address indexed tokenAddress, string name, string symbol);

  constructor(uint256 _creationFee, address _feeReceipt, uint256 _buyTokenFeePercentage) Ownable(msg.sender) {
    creationFee = _creationFee;
    feeReceipt = _feeReceipt;
    buyTokenFeePercentage = _buyTokenFeePercentage;
  }

  function createToken(string memory _name, string memory _symbol) external payable returns (address) {
    if (msg.value < creationFee) revert InsufficientCreationFee();

    (bool success, ) = feeReceipt.call{value: creationFee}("");
    if (!success) revert FailedToSendFee();

    if (msg.value > creationFee) {
      uint256 change = msg.value - creationFee;
      (bool success, ) = msg.sender.call{value: change}("");
      if (!success) revert FailedToRefund();
    }

    Token token = new Token(_name, _symbol, feeReceipt, buyTokenFeePercentage);
    token.transferOwnership(msg.sender);
    emit TokenCreated(address(token), _name, _symbol);
    return address(token);
  }

  function setCreationFee(uint256 _creationFee) external onlyOwner {
    creationFee = _creationFee;
  }

  function setFeeReceipt(address _feeReceipt) external onlyOwner {
    feeReceipt = _feeReceipt;
  }

  function setBuyTokenFeePercentage(uint256 _buyTokenFeePercentage) external onlyOwner {
    buyTokenFeePercentage = _buyTokenFeePercentage;
  }
}