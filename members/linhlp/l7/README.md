# Lesson 07: Liquidity Pool & AMM System

This project implements a Liquidity Pool and Automated Market Maker (AMM) system based on the Constant Product Formula (x \* y = k).

## Project Structure

```
l7/
├── contracts/
│   ├── factories/
│   │   └── LPFactory.sol      # Factory contract to create LP pools
│   ├── tokens/
│   │   └── LPToken.sol         # Core AMM contract
│   └── libraries/
│       └── FullMath.sol        # Precision math library
├── test/
│   ├── LPFactory.test.ts       # Tests for LPFactory
│   ├── LPToken.test.ts        # Tests for LPToken
│   └── utils.ts               # Test utilities
├── scripts/                    # Deployment and interaction scripts
├── hardhat.config.ts          # Hardhat configuration
└── package.json
```

## Features

- **LPFactory**: Creates and registers liquidity pool pairs
- **LPToken**: Implements AMM with constant product formula
  - Add/Remove liquidity
  - Swap tokens (exact in/out)
  - 0.3% trading fee
  - Slippage protection

## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Compile Contracts

```bash
pnpm compile
```

### Run Tests

```bash
pnpm test
```

### Run Local Node

```bash
pnpm node
```

## Contracts

### LPFactory

Factory contract that deploys new LP Token pairs.

**Functions:**

- `createLP(address tokenA, address tokenB)`: Creates a new liquidity pool

### LPToken

Core AMM contract managing pool reserves and swaps.

**Functions:**

- `addLiquidity(uint256 amount0, uint256 amount1)`: Add liquidity to the pool
- `removeLiquidity(uint256 liquidity)`: Remove liquidity from the pool
- `swapExactIn(uint256 amountIn, bool isBuy, uint256 minAmountOut)`: Swap with exact input
- `swapExactOut(uint256 amountOut, bool isBuy, uint256 maxAmountIn)`: Swap with exact output
- `getAmountOut(...)`: Calculate output amount
- `getAmountIn(...)`: Calculate required input
- `getReserves()`: Get current reserves and k value

## Mathematical Formulas

### Constant Product Formula

```
x * y = k
```

### Swap Calculations (with 0.3% fee)

**Selling (token0 → token1):**

```
effective_Δx = Δx * 997 / 1000
Δy = (effective_Δx * y) / (x + effective_Δx)
```

**Buying (token1 → token0):**

```
required_Δy = (Δx * y * 1000) / ((x - Δx) * 997)
```

## License

UNLICENSED
