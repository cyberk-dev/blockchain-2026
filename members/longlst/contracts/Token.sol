pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 public price; // Price in wei per token (with 18 decimals)
    address public owner;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 cost);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(
      string memory _name, 
      string memory _symbol, 
      uint256 _initialSupply,
      uint256 _price // Price in wei per token (e.g., 0.001 ether = 1000000000000000)
    ) ERC20(_name, _symbol) {
        owner = msg.sender;
        price = _price;
        _mint(msg.sender, _initialSupply);
    }

    // Buy tokens by sending ETH
    function buyTokens(uint256 _amount) external payable {
        require(price > 0, "Token price not set");
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 cost = (_amount * price) / 1e18; // Calculate cost based on token amount
        require(msg.value >= cost, "Insufficient ETH sent");
        
        // Transfer tokens from owner to buyer
        require(balanceOf(owner) >= _amount, "Not enough tokens in owner's balance");
        _transfer(owner, msg.sender, _amount);
        
        // Refund excess ETH if any
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
        
        emit TokensPurchased(msg.sender, _amount, cost);
    }

    // Update token price (only owner)
    function setPrice(uint256 _newPrice) external onlyOwner {
        uint256 oldPrice = price;
        price = _newPrice;
        emit PriceUpdated(oldPrice, _newPrice);
    }

    // Withdraw ETH from contract (only owner)
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        payable(owner).transfer(balance);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}