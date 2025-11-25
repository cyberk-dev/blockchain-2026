# Exercise 5: Fees, Events & Refinement

## 1. Refine Bonding Curve (Ex 3 & 4)
- Complete the implementation of the linear bonding curve: $y = ax + b$.
- **Requirement**: Include a link to [WolframAlpha](https://www.wolframalpha.com/) demonstrating the integral proof for your cost calculation.
- **Parameters**: Choose random values for $a$ (slope) and $b$ (initial price).
  - You can choose your own scale (e.g., $10^{22}$).

## 2. Factory Contract Fees
- Implement a `TokenFactory` to deploy new tokens.
- **Creation Fee**:
  - Require a fixed amount of **native ETH** (x ETH) when calling `createToken`.
  - Transfer this fee to a configurable `fee_receipt` address.

## 3. Buy Token Fees & Events
- **Transaction Fee**:
  - When buying tokens, deduct a percentage fee (**y%**) from the payment amount.
  - Send this fee to the `fee_receipt` address.
- **Events**:
  - Emit an event when a purchase occurs (e.g., `TokensPurchased`).
- **Testing**:
  - Write a test case that specifically parses the transaction receipt to verify the emitted event parameters.
