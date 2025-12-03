# Lesson 07: Liquidity Pool & AMM Mechanics

This document outlines the core mechanics of a Liquidity Pool and Automated Market Maker (AMM) based on the Constant Product Formula.

## 1. Liquidity Initialization
When a pool is created, initial liquidity must be provided for both tokens (e.g., PEPE and USDT).

*   **Example Setup**:
    *   **Reserves**: 10 PEPE (ERC20) + 4000 USDT (ERC20)
    *   **Constant Product ($k$)**: $k = 10 \times 4000 = 40,000$
*   **LP Tokens**:
    *   Liquidity Provider (LP) tokens are minted to the initial provider.
    *   The initial supply is typically calculated based on the maximum of the two assets provided (e.g., `Max(PEPE, USDT)`) or the geometric mean $\sqrt{x \cdot y}$.

## 2. Trading Formulas (AMM)
The AMM relies on the constant product formula:
$$ x \cdot y = k $$

Where:
*   $x$: Reserve of Token A
*   $y$: Reserve of Token B
*   $k$: Constant invariant

### Buying Token X (Swap Y $\rightarrow$ X)
User gives $\Delta y$ (Input) to receive $\Delta x$ (Output).
Pool state changes: $(x - \Delta x) \cdot (y + \Delta y) = k$

Derivation for required $\Delta y$:
$$ x \cdot y + x \cdot \Delta y - \Delta x \cdot y - \Delta x \cdot \Delta y = k $$
$$ x \cdot \Delta y - \Delta x \cdot \Delta y = k - x \cdot y + \Delta x \cdot y $$
$$ \Delta y \cdot (x - \Delta x) = \Delta x \cdot y $$
$$ \Delta y = \frac{\Delta x \cdot y}{x - \Delta x} $$

### Selling Token X (Swap X $\rightarrow$ Y)
User gives $\Delta x$ (Input) to receive $\Delta y$ (Output).
Pool state changes: $(x + \Delta x) \cdot (y - \Delta y) = k$

Derivation for received $\Delta y$:
$$ x \cdot y - x \cdot \Delta y + \Delta x \cdot y - \Delta x \cdot \Delta y = k $$
$$ -x \cdot \Delta y + \Delta x \cdot y - \Delta x \cdot \Delta y = 0 $$
$$ \Delta x \cdot y = \Delta y \cdot (x + \Delta x) $$
$$ \Delta y = \frac{\Delta x \cdot y}{x + \Delta x} $$

## 3. Slippage
Slippage is the difference between the expected price and the executed price.
*   In practice, it sets a maximum threshold for $\Delta y$ (input cost) the user is willing to spend for a specific $\Delta x$.
*   **Formula**: $d_y = \text{calculated\_}d_y \times (1 + \text{slippage})$

## 4. Swap Types
Different interfaces for interacting with the pool:
*   **buy_exact_in**: Input amount is fixed; calculate maximum output.
*   **buy_exact_out**: Desired output amount is fixed; calculate required input.
*   **sell_exact_in**: Input amount to sell is fixed; calculate output revenue.
*   **sell_exact_out**: Desired output revenue is fixed; calculate required input to sell.

## 5. Fees
*   **Fee Rate**: 0.3%
*   **Application**:
    *   **Selling**: The effective input amount is reduced by the fee before the swap calculation.
        *   $\text{effective\_}\Delta x = \Delta x \times 0.997$
    *   **Buying**: The required input amount is increased to cover the fee.
        *   $\text{required\_}\Delta y = \text{calculated\_}\Delta y \times 1.003$ (approx)

## 6. Liquidity Management
### Adding Liquidity (Add LP)
LPs must add tokens in a ratio proportional to the current reserves to avoid changing the price.
*   **Example**:
    *   **Current Reserves**: 10 WPEPE / 1000 USDT
    *   **User Adds**: 20 PEPE / 2000 USDT
    *   **New Reserves**: 30 PEPE / 3000 USDT

### Removing Liquidity (Remove LP)
LPs burn their LP tokens to withdraw their proportional share of the pool's underlying assets.

## 7. Contract Structure
*   **LPFactory**:
    *   Deploys new LP Token contracts (pairs).
    *   Registry of all pools.
*   **LPToken**:
    *   Manages the pool reserves.
    *   Handles `add_liquidity` and `remove_liquidity`.
    *   Executes `swap_exact_*` functions.
