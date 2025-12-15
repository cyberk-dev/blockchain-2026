# Uniswap V2 Clone - Development Guide

## Overview

You will build 3 main contracts:
1. **PEPE.sol** - Simple ERC20 token for testing
2. **USDT.sol** - Simple ERC20 token for testing
3. **LPFactory.sol** - Factory to create liquidity pools
4. **LPToken.sol** - The liquidity pool (pair) contract itself

## Phase 1: Mock Token Contracts

### PEPE.sol and USDT.sol

**Purpose:** Create two simple ERC20 tokens for testing the DEX.

**What you need:**
- Import OpenZeppelin's ERC20
- Inherit from ERC20
- Constructor that mints initial supply to deployer
- Optional: Add a public `mint()` function for testing

**State variables:**
- None beyond what ERC20 provides

**Functions needed:**
- Constructor: Pass name and symbol to ERC20, mint initial supply
- Optional mint function: Allow anyone to mint tokens for testing

**Design decisions:**
- Initial supply: 1,000,000 tokens is reasonable
- Decimals: Use default 18
- Mintable: Yes, for easier testing

---

## Phase 2: Core Pool Contract (LPToken.sol)

### Architecture Overview

This contract serves TWO purposes:
1. It's an ERC20 token (the LP token users receive)
2. It's the pool that holds reserves and handles swaps

Think of it as: The LP token IS the pool itself.

### State Variables You Need

**Token addresses:**
- Store addresses of the two tokens in the pair (token0, token1)
- Decide: Will you use token0/token1 or tokenA/tokenB naming?

**Reserves:**
- Two uint256 variables to track how much of each token is in the pool
- These represent the "x" and "y" in x * y = k

**Optional but useful:**
- Store k constant separately for gas optimization
- Add a lock variable for reentrancy protection

### Constructor Logic

**Parameters needed:**
- Address of first token
- Address of second token

**What it should do:**
1. Call parent ERC20 constructor with LP token name/symbol
2. Store the two token addresses
3. Initialize reserves to zero
4. Consider: Should you sort token addresses to ensure token0 < token1? (Uniswap does this)

### Function 1: addLiquidity

**Purpose:** Let users deposit tokens and receive LP tokens.

**Parameters:**
- Amount of token0 to deposit
- Amount of token1 to deposit

**Logic flow:**

**Step 1 - Check if this is first liquidity:**
- If totalSupply of LP tokens is zero, this is the first deposit
- If not zero, this is a subsequent deposit

**Step 2 - Calculate LP tokens to mint:**

For FIRST liquidity provider:
- Use the simpler formula from requirements: `Max(amount0, amount1)`
- Alternative: Use `sqrt(amount0 * amount1)` like real Uniswap
- Choose one and stick with it

For SUBSEQUENT liquidity providers:
- Calculate what percentage of the pool their deposit represents
- Formula: Take the MINIMUM of two ratios:
  - Ratio 1: `(amount0 / reserve0) * totalSupply`
  - Ratio 2: `(amount1 / reserve1) * totalSupply`
- Why minimum? To prevent someone from adding unbalanced liquidity and stealing value
- This forces users to add liquidity at the current price ratio

**Step 3 - Transfer tokens from user:**
- Use `transferFrom` to pull token0 from msg.sender to this contract
- Use `transferFrom` to pull token1 from msg.sender to this contract
- Remember: User must have approved this contract first

**Step 4 - Update reserves:**
- Increase reserve0 by amount0
- Increase reserve1 by amount1
- Update k constant: `k = reserve0 * reserve1`

**Step 5 - Mint LP tokens:**
- Call internal `_mint(msg.sender, lpAmount)`
- Emit an event (optional but good practice)

**Edge cases to consider:**
- What if user sends 0 for either amount? Revert
- What if amounts don't match the pool ratio? They'll get fewer LP tokens (handled by min calculation)
- What if pool reserves are 0? Handled by the first liquidity check

### Function 2: removeLiquidity

**Purpose:** Let users burn LP tokens to withdraw their share of tokens.

**Parameters:**
- Amount of LP tokens to burn

**Logic flow:**

**Step 1 - Calculate share percentage:**
- Share = lpAmount / totalSupply
- This tells you what percentage of the pool they own

**Step 2 - Calculate token amounts to return:**
- Amount of token0 = reserve0 * share
- Amount of token1 = reserve1 * share
- Use integer math carefully to avoid rounding errors

**Step 3 - Burn LP tokens:**
- Call internal `_burn(msg.sender, lpAmount)`
- This reduces totalSupply

**Step 4 - Update reserves:**
- Decrease reserve0 by calculated amount
- Decrease reserve1 by calculated amount
- Update k constant

**Step 5 - Transfer tokens to user:**
- Transfer token0 to msg.sender
- Transfer token1 to msg.sender
- Emit event (optional)

**Edge cases:**
- What if user tries to burn more LP than they have? ERC20 will revert automatically
- What if burning would drain the pool completely? Allow it - that's valid
- Consider: Minimum liquidity lock (Uniswap locks 1000 wei forever on first mint)

### Function 3: swapExactIn

**Purpose:** Swap tokens where you specify the EXACT INPUT amount (how much you're spending). This works for both buying and selling - just swap the input/output tokens.

**Parameters:**
- Address of input token (which token they're selling)
- Address of output token (which token they're buying)
- Amount of input token
- Minimum amount of output token (slippage protection)

**Logic flow:**

**Step 1 - Determine direction:**
- If inputToken == token0, then outputToken must be token1
- If inputToken == token1, then outputToken must be token0
- If neither matches, revert with error

**Step 2 - Identify reserves:**
- Figure out which reserve corresponds to input and which to output
- Let's call them reserveIn and reserveOut

**Step 3 - Apply trading fee (0.3%):**
- Real input after fee = amountIn * 997 / 1000
- This takes 0.3% fee from the input amount
- Fee stays in the pool, benefiting LP holders

**Step 4 - Calculate output amount:**
- Use the constant product formula
- Formula: `amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)`
- This maintains x * y = k (approximately, k grows due to fees)

**Derivation reminder (you already have this in req.md):**
```
(x + dx) * (y - dy) = k
Solve for dy:
dy = (dx * y) / (x + dx)

Where dx already has fee applied
```

**Step 5 - Check slippage protection:**
- If amountOut < minAmountOut, revert
- This protects user from unfavorable price movement

**Step 6 - Transfer tokens:**
- Pull input token from user: `inputToken.transferFrom(msg.sender, address(this), amountIn)`
- Send output token to user: `outputToken.transfer(msg.sender, amountOut)`

**Step 7 - Update reserves:**
- Increase reserveIn by amountIn
- Decrease reserveOut by amountOut
- Update k constant

**Step 8 - Emit event:**
- Emit Swap event with all relevant data

**Edge cases:**
- What if amountIn is 0? Revert
- What if calculated amountOut is 0? Probably should revert
- What if output amount is larger than available reserves? Math will make this impossible
- What if tokens don't match? Already handled in step 1

**Usage examples:**
- Buying PEPE with USDT: User calls `swapExactIn(USDT, PEPE, 100 USDT, minPEPE)`
- Selling PEPE for USDT: User calls `swapExactIn(PEPE, USDT, 5 PEPE, minUSDT)`

Same function handles both directions!

### Function 4: swapExactOut

**Purpose:** Swap tokens where you specify the EXACT OUTPUT amount (how much you want to receive). This also works for both buying and selling.

**Parameters:**
- Input token address
- Output token address
- Exact amount of output tokens desired
- Maximum input tokens willing to spend

**Logic flow:**

**Step 1-2:** Same as regular swap (determine direction)

**Step 3 - Calculate required input (reverse formula):**
- This is the tricky part - you need to work backwards
- Formula: `amountIn = (reserveIn * amountOut * 1000) / ((reserveOut - amountOut) * 997) + 1`
- The +1 ensures rounding in pool's favor

**Derivation:**
```
Start with: amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)

Solve for amountIn:
amountOut * (reserveIn + amountInWithFee) = amountInWithFee * reserveOut
amountOut * reserveIn + amountOut * amountInWithFee = amountInWithFee * reserveOut
amountOut * reserveIn = amountInWithFee * reserveOut - amountOut * amountInWithFee
amountOut * reserveIn = amountInWithFee * (reserveOut - amountOut)
amountInWithFee = (amountOut * reserveIn) / (reserveOut - amountOut)

But remember: amountInWithFee = amountIn * 997 / 1000
So: amountIn = (amountInWithFee * 1000) / 997
```

**Step 4 - Check max input:**
- If calculated amountIn > maxAmountIn, revert
- This is the slippage protection for this function

**Step 5 - Transfer tokens:**
- Pull calculated amountIn from user
- Send exact amountOut to user

**Step 6 - Update reserves:**
- Increase reserveIn by amountIn
- Decrease reserveOut by amountOut
- Update k constant

**Step 7 - Emit event:**
- Emit Swap event with all relevant data

**Usage examples:**
- Want exactly 1 PEPE: User calls `swapExactOut(USDT, PEPE, 1 PEPE, maxUSDT)`
- Want exactly 100 USDT: User calls `swapExactOut(PEPE, USDT, 100 USDT, maxPEPE)`

Same function handles both directions!

**Note:** These 2 swap functions (swapExactIn and swapExactOut) are ALL you need. You don't need separate buy/sell functions because:
- The pair is symmetric: PEPE/USDT = USDT/PEPE
- Direction is determined by which token you pass as input vs output
- Both "buying PEPE" and "selling PEPE" use the same constant product formula

### View Functions (Helpers)

These functions don't modify state but help users:

**getReserves:**
- Returns current reserve0, reserve1, and k
- Useful for calculating prices off-chain

**getAmountOut:**
- Given an input amount, calculate output amount
- Pure calculation, no state change
- Lets users preview swap before executing

**getAmountIn:**
- Given desired output amount, calculate required input
- Pure calculation, no state change

**getPrice:**
- Returns current price ratio
- Can return both directions: token0-per-token1 and token1-per-token0

### Events to Emit

**Mint:**
- When liquidity is added
- Log: sender, amount0, amount1, lpAmount

**Burn:**
- When liquidity is removed
- Log: sender, amount0, amount1, lpAmount

**Swap:**
- When tokens are swapped
- Log: sender, amountIn, amountOut, token addresses

---

## Phase 3: Factory Contract (LPFactory.sol)

### Purpose

The factory creates and tracks all liquidity pools. It ensures only one pool exists per token pair.

### State Variables

**Mapping to track pairs:**
- Need a way to look up pool address from two token addresses
- Suggestion: Nested mapping: `mapping(address => mapping(address => address))`
- This allows: `getPair[tokenA][tokenB] => poolAddress`

**Array of all pairs (optional):**
- Store an array of all created pool addresses
- Useful for enumeration: "show me all pools"

### Constructor

**Parameters:**
- Usually none for a factory

**Logic:**
- Nothing special needed, unless you want to set an admin

### Function: createPair

**Purpose:** Deploy a new LPToken contract for a token pair.

**Parameters:**
- Address of tokenA
- Address of tokenB

**Logic flow:**

**Step 1 - Validate inputs:**
- Check that tokenA != tokenB
- Check that neither is zero address
- Check that tokenA != address(this) and same for tokenB

**Step 2 - Sort tokens:**
- Ensure token0 < token1 (address comparison)
- This prevents duplicate pools: PEPE/USDT and USDT/PEPE should be same pool
- After sorting: token0 is the lower address, token1 is higher

**Step 3 - Check if pair already exists:**
- Look up in mapping: `getPair[token0][token1]`
- If it's not zero address, pair already exists - revert

**Step 4 - Deploy new pool:**
- Create new LPToken contract: `new LPToken(token0, token1)`
- Get the address of newly deployed contract

**Step 5 - Record the pair:**
- Store in both directions of mapping:
  - `getPair[token0][token1] = poolAddress`
  - `getPair[token1][token0] = poolAddress`
- Add to array if you have one

**Step 6 - Emit event:**
- Emit PairCreated event with token0, token1, poolAddress

**Return value:**
- Return the address of newly created pool

### View Function: getPair

**Purpose:** Look up pool address for a token pair.

**Parameters:**
- tokenA address
- tokenB address

**Logic:**
- Simply return `getPair[tokenA][tokenB]`
- If no pool exists, returns zero address

---

## Phase 4: Testing Strategy

### Test File 1: Token Tests (Token.test.ts)

**Purpose:** Verify your mock tokens work.

**Test cases:**
1. Deployment mints correct initial supply
2. Mint function works (if you added it)
3. Transfer works
4. Approve and transferFrom work

This should be quick - tokens are standard ERC20.

### Test File 2: Factory Tests (LPFactory.test.ts)

**Test cases:**

**Test 1 - Create first pair:**
- Deploy PEPE and USDT tokens
- Deploy factory
- Call createPair(PEPE, USDT)
- Verify: Returns a valid address
- Verify: getPair(PEPE, USDT) returns that address
- Verify: getPair(USDT, PEPE) also returns same address (symmetry)

**Test 2 - Cannot create duplicate pair:**
- Create PEPE/USDT pair
- Try to create PEPE/USDT again
- Verify: Transaction reverts

**Test 3 - Cannot create pair with same token:**
- Try createPair(PEPE, PEPE)
- Verify: Transaction reverts

**Test 4 - Cannot create pair with zero address:**
- Try createPair(PEPE, address(0))
- Verify: Transaction reverts

### Test File 3: Pool Tests (LPToken.test.ts)

This is the big one. You'll need a fixture that deploys everything.

**Fixture setup:**
```
1. Deploy PEPE token
2. Deploy USDT token
3. Deploy LPFactory
4. Create PEPE/USDT pair via factory
5. Get the pair address
6. Mint tokens to test accounts
7. Approve pair contract to spend tokens
8. Return all contracts and accounts
```

**Test Group A - Add Liquidity:**

**Test A1 - First liquidity addition:**
- Add 10 PEPE + 4000 USDT (from requirements)
- Verify: LP tokens minted = Max(10, 4000) = 4000 (or sqrt if you chose that)
- Verify: reserve0 = 10
- Verify: reserve1 = 4000
- Verify: k = 40000
- Verify: PEPE and USDT transferred from user to pool

**Test A2 - Second liquidity addition (proportional):**
- Initial state: 10 PEPE + 4000 USDT pool
- User adds: 20 PEPE + 8000 USDT
- Expected LP tokens: calculated from proportion
- Verify: All reserves updated correctly
- Verify: User's LP balance increased

**Test A3 - Liquidity addition (unbalanced) - edge case:**
- Initial state: 10 PEPE + 4000 USDT pool
- User tries to add: 10 PEPE + 10000 USDT (too much USDT)
- Should still work but user gets fewer LP tokens than optimal
- The extra USDT benefits existing LPs slightly

**Test A4 - Cannot add zero liquidity:**
- Try to add 0 PEPE + 0 USDT
- Verify: Reverts

**Test Group B - Remove Liquidity:**

**Test B1 - Remove partial liquidity:**
- Setup: Pool has 10 PEPE + 4000 USDT, user has 4000 LP
- User burns: 1000 LP (25% of supply)
- Expected return: 2.5 PEPE + 1000 USDT
- Verify: Correct amounts returned
- Verify: Reserves updated
- Verify: LP tokens burned

**Test B2 - Remove all liquidity:**
- User burns all their LP tokens
- Verify: Gets back their full share
- Verify: Pool reserves decrease correctly

**Test B3 - Cannot remove more than owned:**
- User tries to burn more LP tokens than balance
- Verify: Reverts (ERC20 handles this)

**Test Group C - Swaps:**

**Test C1 - Swap USDT for PEPE (exact input):**
- Initial pool: 10 PEPE + 4000 USDT
- User swaps: 100 USDT
- Calculate expected PEPE output using formula
- Verify: User receives correct amount of PEPE (within rounding)
- Verify: Reserves updated correctly
- Verify: k increased slightly (due to fees)

**Test C2 - Swap PEPE for USDT:**
- Initial pool: 10 PEPE + 4000 USDT
- User swaps: 1 PEPE
- Calculate expected USDT output
- Verify: Correct output
- Verify: Reserves updated

**Test C3 - Slippage protection works:**
- User swaps with minAmountOut too high
- Verify: Transaction reverts

**Test C4 - Large swap has price impact:**
- Initial price: 1 PEPE = 400 USDT
- User swaps large amount (e.g., 2000 USDT)
- Verify: Gets fewer PEPE per USDT than initial price
- Document the price impact percentage

**Test C5 - Swap exact output (if implemented):**
- User wants exactly 1 PEPE out
- Calculate required USDT input
- Execute swap
- Verify: User receives exactly 1 PEPE
- Verify: User spent calculated amount (plus slippage)

**Test Group D - View Functions:**

**Test D1 - getReserves returns correct values:**
- After adding liquidity, call getReserves()
- Verify: Returns match expected reserves

**Test D2 - getAmountOut calculation matches actual swap:**
- Call getAmountOut(100 USDT for PEPE)
- Note the returned value
- Execute actual swap with 100 USDT
- Verify: Actual output matches preview

**Test D3 - getPrice returns correct ratio:**
- Pool: 10 PEPE + 4000 USDT
- Call getPrice()
- Verify: Returns ~400 (price of PEPE in USDT)

**Test Group E - Integration Tests:**

**Test E1 - Full flow (add, swap, remove):**
- User A adds liquidity
- User B swaps tokens
- User A removes liquidity (should have more due to fees)
- Verify: User A profited from fees

**Test E2 - Multiple swaps accumulate fees:**
- Add initial liquidity
- Execute multiple swaps
- Verify: k value increases over time
- Remove liquidity and verify: Got back more than originally added

### Wolfram Alpha Verification

For mathematical accuracy, verify your formulas using Wolfram:

**For swap calculation:**
```
Query: "solve (4000 + 100*0.997) * (10 - x) = 40000 for x"
Verify your getAmountOut function returns this value
```

**For price impact:**
```
Query: "((4100 / 9.7568) - 400) / 400 * 100"
This gives you percentage price impact
```

---

## Phase 5: Deployment (Ignition Modules)

### Module 1: Deploy Tokens (deployTokens.ts)

**Purpose:** Deploy PEPE and USDT for testing.

**Structure:**
- Deploy PEPE contract
- Deploy USDT contract
- Return both contract instances

### Module 2: Deploy Factory (deployFactory.ts)

**Purpose:** Deploy the factory contract.

**Structure:**
- Deploy LPFactory
- Return factory instance

### Module 3: Full Deployment (deployAll.ts)

**Purpose:** Deploy everything and create initial pool.

**Structure:**
- Deploy tokens (using Module 1)
- Deploy factory (using Module 2)
- Create PEPE/USDT pair via factory
- Optionally: Add initial liquidity
- Return everything

**Parameters you might need:**
- Initial liquidity amounts (if adding automatically)

---

## Phase 6: Implementation Order

Follow this sequence to build incrementally:

### Day 1: Tokens
1. Create PEPE.sol
2. Create USDT.sol
3. Write token tests
4. Verify tests pass

### Day 2: Factory
1. Create LPFactory.sol (just pair creation, no logic yet)
2. Write factory tests
3. Verify tests pass

### Day 3: Pool (Part 1 - Liquidity)
1. Create LPToken.sol
2. Implement constructor
3. Implement addLiquidity (just first liquidity case)
4. Write tests for first liquidity addition
5. Verify tests pass
6. Implement addLiquidity (subsequent liquidity)
7. Write tests for subsequent additions
8. Verify tests pass

### Day 4: Pool (Part 2 - Removal)
1. Implement removeLiquidity
2. Write tests for liquidity removal
3. Verify tests pass

### Day 5: Pool (Part 3 - Swaps)
1. Implement swap function (exact input version)
2. Write tests for swaps
3. Verify tests pass with Wolfram calculations
4. Add slippage protection test

### Day 6: Pool (Part 4 - Advanced)
1. Implement view helper functions
2. Optionally implement exact output swap
3. Write integration tests
4. Test full user flows

### Day 7: Polish
1. Write deployment scripts
2. Test deployment on local network
3. Add events if missing
4. Clean up code
5. Document any tricky math

---

## Common Pitfalls to Avoid

### Math Pitfalls

**Problem:** Integer division loses precision
**Solution:** Do multiplications before divisions
**Example:** `(a * b) / c` not `(a / c) * b`

**Problem:** Overflow in reserve multiplication
**Solution:** For very large reserves, consider using SafeMath or OpenZeppelin's Math library

**Problem:** Rounding errors in LP calculations
**Solution:** Always round in favor of the pool, not the user

### Token Transfer Pitfalls

**Problem:** Forgot to approve pool contract
**Solution:** In tests, always approve before calling addLiquidity or swap

**Problem:** Using transfer instead of transferFrom
**Solution:** When pulling tokens FROM user, always use transferFrom

**Problem:** Not checking transfer return values
**Solution:** Some tokens return false instead of reverting - handle this

### Reentrancy Pitfalls

**Problem:** External calls before state updates
**Solution:** Follow checks-effects-interactions pattern:
1. Check conditions (require statements)
2. Update state (change reserves, mint/burn)
3. Interact with external contracts (token transfers)

**Problem:** Malicious tokens calling back into pool
**Solution:** Use OpenZeppelin's ReentrancyGuard or manual lock

### Business Logic Pitfalls

**Problem:** Not sorting token addresses in factory
**Solution:** Always ensure token0 < token1 to prevent duplicate pools

**Problem:** Allowing zero address tokens
**Solution:** Validate token addresses are not zero

**Problem:** Not checking pool already exists
**Solution:** Always check mapping before deploying new pool

---

## Testing Checklist

Before considering yourself done:

- [ ] All token tests pass
- [ ] All factory tests pass
- [ ] First liquidity addition works
- [ ] Subsequent liquidity additions work
- [ ] Liquidity removal works
- [ ] USDT→PEPE swap works
- [ ] PEPE→USDT swap works
- [ ] Slippage protection works
- [ ] Price impact is calculated correctly
- [ ] View functions return correct values
- [ ] Integration test (add→swap→remove) passes
- [ ] Wolfram Alpha verified at least 2 swap calculations
- [ ] All tests run without errors
- [ ] Deployment script works on local Hardhat network

---

## Success Metrics

You'll know you succeeded when:

1. You can add 10 PEPE + 4000 USDT and receive LP tokens
2. You can swap 100 USDT and receive ~0.243 PEPE (Wolfram verified)
3. You can remove liquidity and get your tokens back plus earned fees
4. Price updates automatically after each swap
5. Large swaps have visible price impact
6. Multiple users can interact with same pool simultaneously
7. All math matches Wolfram Alpha calculations

---

## Formula Quick Reference

Keep these handy while coding:

**Initial LP:** `LP = Max(amount0, amount1)` or `sqrt(amount0 * amount1)`

**Subsequent LP:** `LP = min((amt0/res0) * supply, (amt1/res1) * supply)`

**Remove amounts:** `amount = (LP_burned / totalSupply) * reserve`

**Swap output:** `out = (in * 997 * reserveOut) / (reserveIn * 1000 + in * 997)`

**Swap input:** `in = (reserveIn * out * 1000) / ((reserveOut - out) * 997) + 1`

**Current price:** `price = reserve1 / reserve0`

**Constant:** `k = reserve0 * reserve1` (should increase over time due to fees)

---

## Optional Enhancements (After Core Works)

Once everything above works, consider:

1. **Price oracle:** Track time-weighted average price
2. **Flash swaps:** Allow borrowing tokens within single transaction
3. **Fee switch:** Allow protocol to take cut of LP fees
4. **Minimum liquidity:** Lock first 1000 wei of LP tokens forever (like Uniswap)
5. **Multiple pools:** Create PEPE/WETH, USDT/WETH pools
6. **Router contract:** Helper contract for multi-hop swaps
7. **Frontend:** Build simple UI to interact with contracts

---

## Final Notes

**Remember:**
- Start simple, add complexity gradually
- Test each piece before moving to next
- Use Wolfram to verify math
- Read error messages carefully
- Don't be afraid to console.log in tests
- Compare with real Uniswap V2 when stuck

**When debugging swaps:**
1. Print all reserves before swap
2. Print calculated output
3. Execute swap
4. Print all reserves after swap
5. Verify k increased slightly

**You got this!** Take it one function at a time, test thoroughly, and you'll have a working DEX.
