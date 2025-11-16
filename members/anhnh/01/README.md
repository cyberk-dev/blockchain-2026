# Hardhat Project - anhnh

This is a Hardhat project for learning blockchain development.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Compile contracts:
```bash
npm run compile
```

3. Run tests:
```bash
npm test
```

## Contract

### SimpleToken

An ERC20 token contract that:
- Inherits from OpenZeppelin's ERC20 and Ownable contracts
- Constructor accepts `name` and `symbol` parameters
- Has a `mint(address to, uint256 amount)` function that can only be called by the owner

## Test

The test file includes tests for:
- Deployment (owner, name, symbol)
- Minting functionality
- Owner-only access control

