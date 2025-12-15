# Uniswap V2 Clone - Architecture Plan

## 1. Overall Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      LPFactory                          │
│  - createPair(tokenA, tokenB)                          │
│  - getPair(tokenA, tokenB) → LPToken address           │
│  - Stores mapping of token pairs to LP contracts       │
└─────────────────┬───────────────────────────────────────┘
                  │ creates
                  ↓
┌─────────────────────────────────────────────────────────┐
│                  LPToken (Pair Contract)                │
│  - Inherits ERC20 (LP token itself)                    │
│  - Holds reserves: (reservePEPE, reserveUSDT)          │
│  - swap() - execute swaps                              │
│  - addLiquidity() - provide liquidity                  │
│  - removeLiquidity() - withdraw liquidity              │
└─────────────────┬───────────────────────────────────────┘
                  │ holds
                  ↓
         ┌────────────────┐
         │  PEPE + USDT   │
         │   Reserves     │
         └────────────────┘
```

## 2. Initial Liquidity Creation Flow

```
User wants to create PEPE/USDT pair
         ↓
┌──────────────────────────────────────┐
│ 1. Call LPFactory.createPair()       │
│    - tokenA: PEPE                    │
│    - tokenB: USDT                    │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 2. Factory deploys new LPToken      │
│    - Stores pair in mapping          │
│    pair[PEPE][USDT] = LPToken addr   │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 3. User calls LPToken.addLiquidity() │
│    - Transfers 10 PEPE → LPToken     │
│    - Transfers 4000 USDT → LPToken   │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 4. Calculate LP tokens to mint      │
│    Initial: sqrt(x * y)              │
│    = sqrt(10 * 4000)                 │
│    = sqrt(40000) = 200 LP tokens     │
│                                       │
│    Or use Max(PEPE, USDT) = 4000 LP  │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ 5. Mint LP tokens to user            │
│    - User receives LP tokens          │
│    - Reserves updated:                │
│      reservePEPE = 10                 │
│      reserveUSDT = 4000               │
│      k = 40000                        │
└───────────────────────────────────────┘
```

## 3. LP Token Minting Logic

### First Liquidity Provider:
```
LP_minted = sqrt(amount_tokenA * amount_tokenB)

Or simpler (per requirements):
LP_minted = Max(amount_tokenA, amount_tokenB)

Example: 10 PEPE + 4000 USDT
LP = Max(10, 4000) = 4000 LP tokens
```

### Subsequent Liquidity Providers:
```
Current state:
- reservePEPE = 30
- reserveUSDT = 3000
- totalSupply = 4000 LP tokens

DucCOOK wants to add: 20 PEPE + 2000 USDT

LP_minted = Min(
  (amount_PEPE / reservePEPE) * totalSupply,
  (amount_USDT / reserveUSDT) * totalSupply
)

LP_minted = Min(
  (20 / 30) * 4000 = 2666.67,
  (2000 / 3000) * 4000 = 2666.67
) = 2666.67 LP tokens

Note: Amounts must maintain ratio to avoid losing value
```

### Add Liquidity Flow Diagram:
```
User: addLiquidity(amountPEPE, amountUSDT)
         ↓
┌───────────────────────────────────────┐
│ 1. Check if first liquidity          │
│    if (totalSupply == 0)              │
│       LP = Max(amountA, amountB)      │
│    else                                │
│       LP = proportional calculation   │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 2. Transfer tokens from user          │
│    PEPE.transferFrom(user, this, amt) │
│    USDT.transferFrom(user, this, amt) │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 3. Update reserves                    │
│    reservePEPE += amountPEPE          │
│    reserveUSDT += amountUSDT          │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 4. Mint LP tokens to user             │
│    _mint(user, LP_amount)             │
└───────────────────────────────────────┘
```

## 4. Swap Logic (Buy/Sell with Fees)

### Constant Product Formula:
```
x * y = k (constant)

Where:
- x = reserve of token being sold (e.g., USDT)
- y = reserve of token being bought (e.g., PEPE)
- k = constant product
```

### Buy PEPE with USDT (exact input):
```
Initial state:
- reserveUSDT = 4000 (x)
- reservePEPE = 10 (y)
- k = 40000

User wants to buy PEPE by paying 100 USDT:

Step 1: Apply 0.3% fee
  amountIn_after_fee = 100 * 0.997 = 99.7 USDT

Step 2: Calculate PEPE output
  (x + d_x) * (y - d_y) = k
  d_y = d_x * y / (x + d_x)
  d_y = 99.7 * 10 / (4000 + 99.7)
  d_y = 997 / 4099.7
  d_y = 0.2432 PEPE

Step 3: Update reserves
  reserveUSDT = 4000 + 100 = 4100
  reservePEPE = 10 - 0.2432 = 9.7568
  k = 4100 * 9.7568 = 40002.88 ≈ 40000 (slight increase due to fees)
```

### Swap Flow Diagram:
```
User: swap(tokenIn, tokenOut, amountIn, minAmountOut)
         ↓
┌───────────────────────────────────────────┐
│ 1. Identify direction                     │
│    if tokenIn == PEPE → selling PEPE      │
│    if tokenIn == USDT → buying PEPE       │
└──────────────┬────────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ 2. Apply 0.3% fee                         │
│    amountIn_with_fee = amountIn * 997/1000│
└──────────────┬────────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ 3. Calculate output amount                │
│    using formula:                         │
│    amountOut = (amountIn_fee * reserveOut)│
│              / (reserveIn + amountIn_fee) │
└──────────────┬────────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ 4. Check slippage protection              │
│    require(amountOut >= minAmountOut)     │
└──────────────┬────────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ 5. Transfer tokens                        │
│    tokenIn.transferFrom(user, this, in)   │
│    tokenOut.transfer(user, out)           │
└──────────────┬────────────────────────────┘
               ↓
┌───────────────────────────────────────────┐
│ 6. Update reserves                        │
│    reserveIn += amountIn                  │
│    reserveOut -= amountOut                │
└───────────────────────────────────────────┘
```

## 5. Slippage Protection

```
Without slippage protection:
  User expects: 0.2432 PEPE
  But due to price movement (frontrun), gets: 0.20 PEPE
  → Transaction still succeeds (user loses money)

With slippage protection (e.g., 1%):
  minAmountOut = expected * (1 - slippage)
  minAmountOut = 0.2432 * 0.99 = 0.2408 PEPE

  If actual output < 0.2408 → Transaction reverts
  If actual output ≥ 0.2408 → Transaction succeeds
```

## 6. Two Swap Functions (Both Directions)

You only need 2 swap functions total. Each handles both buy and sell by swapping input/output tokens:

```
1. swapExactIn (exact input)
   ┌──────────────────────────────┐
   │ User: "I want to spend       │
   │       exactly 100 USDT"      │
   │ Output: Calculate PEPE out   │
   │                               │
   │ OR                            │
   │                               │
   │ User: "I want to spend       │
   │       exactly 5 PEPE"        │
   │ Output: Calculate USDT out   │
   └──────────────────────────────┘

2. swapExactOut (exact output)
   ┌──────────────────────────────┐
   │ User: "I want to receive     │
   │       exactly 1 PEPE"        │
   │ Input: Calculate USDT needed │
   │                               │
   │ OR                            │
   │                               │
   │ User: "I want to receive     │
   │       exactly 100 USDT"      │
   │ Input: Calculate PEPE needed │
   └──────────────────────────────┘

Formula differences:
- Exact input:  amountOut = (amountIn_fee * reserveOut) / (reserveIn + amountIn_fee)
- Exact output: amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997)

Note: No need for separate buy/sell functions. Direction is determined by which token
you pass as input vs output. PEPE/USDT pairs are symmetric!
```

## 7. Remove Liquidity Flow

```
User: removeLiquidity(LP_amount)
         ↓
┌───────────────────────────────────────┐
│ 1. Calculate share percentage         │
│    share = LP_amount / totalSupply    │
│                                        │
│    Example:                            │
│    User has: 1000 LP                  │
│    Total: 6666.67 LP                  │
│    Share = 1000 / 6666.67 = 15%       │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 2. Calculate token amounts            │
│    amountPEPE = reservePEPE * share   │
│    amountUSDT = reserveUSDT * share   │
│                                        │
│    Example:                            │
│    reservePEPE = 30                   │
│    reserveUSDT = 3000                 │
│    amountPEPE = 30 * 0.15 = 4.5       │
│    amountUSDT = 3000 * 0.15 = 450     │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 3. Burn LP tokens                     │
│    _burn(user, LP_amount)             │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 4. Transfer tokens to user            │
│    PEPE.transfer(user, amountPEPE)    │
│    USDT.transfer(user, amountUSDT)    │
└──────────────┬────────────────────────┘
               ↓
┌───────────────────────────────────────┐
│ 5. Update reserves                    │
│    reservePEPE -= amountPEPE          │
│    reserveUSDT -= amountUSDT          │
└───────────────────────────────────────┘
```

## 8. Key Formulas Summary

```
1. Initial LP Mint:
   LP = Max(amountA, amountB)
   or LP = sqrt(amountA * amountB)

2. Subsequent LP Mint:
   LP = Min(
     (amountA / reserveA) * totalSupply,
     (amountB / reserveB) * totalSupply
   )

3. Swap Output (exact input):
   amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)

4. Swap Input (exact output):
   amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1

5. Remove Liquidity:
   amountA = (LP_burned * reserveA) / totalSupply
   amountB = (LP_burned * reserveB) / totalSupply
```

## 9. Price Impact Visualization

```
Price before swap: 1 PEPE = 400 USDT
Reserves: 10 PEPE, 4000 USDT

Small swap (10 USDT):
  Output: ~0.0249 PEPE
  Effective price: 401.6 USDT/PEPE
  Price impact: ~0.4%

Large swap (1000 USDT):
  Output: ~1.99 PEPE
  Effective price: 502.5 USDT/PEPE
  Price impact: ~25.6%

Visualization:
Price Impact
    ↑
25% │           ╱
    │          ╱
    │        ╱
10% │      ╱
    │    ╱
 5% │  ╱
    │╱
0%  └─────────────────→ Swap Size
    0   200  600  1000
```
