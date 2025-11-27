# Token Price Calculator - Usage Guide

## Quick Start

### Method 1: Using Hardhat Task (Recommended)

```bash
# Default: 0 tokens sold, buy 10 tokens
npx hardhat check-prices

# Custom: 10 tokens sold, buy 7 tokens
npx hardhat check-prices --tokens-sold=10 --tokens-to-buy=7

# Custom: 3 tokens sold, buy 10 tokens
npx hardhat check-prices --tokens-sold=3 --tokens-to-buy=10

# Only specify tokens to buy (uses default 0 for tokens sold)
npx hardhat check-prices --tokens-to-buy=5
```

### Method 2: Run Test with Custom Values

```bash
# Default: 0 tokens sold, buy 5 tokens
npx hardhat test test/Token.ts

# Custom: 10 tokens sold, buy 7 tokens (using environment variables)
TOKENS_SOLD=10 TOKENS_TO_BUY=7 npx hardhat test test/Token.ts

# Note: Hardhat test command doesn't support custom CLI args directly
# Use the check-prices task for CLI arguments instead
```

### Method 3: Run Script with Custom Values

```bash
# Default: 0 tokens sold, buy 10 tokens
npx hardhat run scripts/check-token-prices.ts

# Custom: 5 tokens sold, buy 3 tokens (using environment variables)
TOKENS_SOLD=5 TOKENS_TO_BUY=3 npx hardhat run scripts/check-token-prices.ts
```

## Parameters

- `--tokens-sold` or `TOKENS_SOLD`: Number of tokens already sold (default: "0")
- `--tokens-to-buy` or `TOKENS_TO_BUY`: Number of tokens to buy (default: "5" for test, "10" for task/script)

## Examples

### Example 1: Check prices for first 5 tokens

```bash
# Using task (recommended)
npx hardhat check-prices --tokens-sold=0 --tokens-to-buy=5

# Or using test
npx hardhat test test/Token.ts --tokens-sold=0 --tokens-to-buy=5
```

Output will show prices for tokens #1, #2, #3, #4, #5

### Example 2: Check prices after 10 tokens have been sold

```bash
# Using task (recommended)
npx hardhat check-prices --tokens-sold=10 --tokens-to-buy=5

# Or using test
npx hardhat test test/Token.ts --tokens-sold=10 --tokens-to-buy=5
```

Output will show prices for tokens #11, #12, #13, #14, #15

### Example 3: Check prices for a large purchase

```bash
# Using task (recommended)
npx hardhat check-prices --tokens-sold=0 --tokens-to-buy=20

# Or using script
TOKENS_SOLD=0 TOKENS_TO_BUY=20 npx hardhat run scripts/check-token-prices.ts
```

Output will show prices for tokens #1 through #20

## Bonding Curve Formula

The price follows the formula: **price = a \* x + b**

Where:

- `a` (slope) = 0.001 ETH (default)
- `b` (starting price) = 0.1 ETH (default)
- `x` = token index (1-indexed)

Example:

- Token #1: 0.001 \* 1 + 0.1 = 0.101 ETH
- Token #2: 0.001 \* 2 + 0.1 = 0.102 ETH
- Token #3: 0.001 \* 3 + 0.1 = 0.103 ETH
