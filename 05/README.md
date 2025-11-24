# Exercise 5: Fees & Finalization

This exercise builds upon and finalizes the work from Exercise 4 (Bonding Curve & ERC20 Payments) by introducing fee mechanisms for the platform deployer.

## 1. Complete Exercise 4 Requirements

Ensure the base implementation from Exercise 4 is in place:
1.  **Bonding Curve**: Implement the linear pricing formula $y = ax + b$.
    -   $y$: Price of the token.
    -   $x$: Current supply.
2.  **ERC20 Payment**: Users must use a Mock ERC20 token (e.g., USDT) to buy tokens instead of native ETH.
3.  **Advanced Testing**: Use the custom Hardhat plugin (`erc20BalancesHaveChanged`) to verify balance changes.

## 2. Fee Implementation

Add the following fee logic to your `TokenFactory` and `Token` contracts:

### 2.1. Token Creation Fee (Native ETH)
When a user creates a new token using the Factory:
-   **Cost**: The user must pay **0.1 ETH**.
-   **Recipient**: This fee is transferred to the **Deployer** (the owner of the Factory).
-   **Logic**:
    -   Update the `createToken` function to be `payable`.
    -   Require `msg.value == 0.1 ether`.
    -   Transfer the received ETH to the deployer.

### 2.2. Buy Token Fee (ERC20)
When a user buys tokens:
-   **Fee Rate**: **10%** of the payment amount.
-   **Recipient**: The fee is transferred to the **Deployer**.
-   **Logic**:
    -   When `buyToken` is called with a payment amount (e.g., `amountIn` of USDT):
        -   Calculate `fee = amountIn * 10 / 100`.
        -   Calculate `amountForCurve = amountIn - fee`.
    -   Transfer `fee` to the deployer.
    -   Use `amountForCurve` to calculate how many tokens the user receives via the bonding curve.
    -   *Note*: Ensure the deployer address is stored or accessible in the Token contract.

## 3. Testing Requirements

Update your test suite to cover these scenarios:

### Creation Fee Tests
1.  **Revert**: Should revert if `createToken` is called with < 0.1 ETH.
2.  **Success**:
    -   User pays 0.1 ETH.
    -   Deployer's ETH balance increases by 0.1 ETH.
    -   Token contract is deployed successfully.

### Buy Fee Tests
1.  **Fee Transfer**:
    -   User buys with `100 USDT`.
    -   Verify `10 USDT` is transferred to the deployer.
    -   Verify `90 USDT` is added to the Token contract's reserve.
2.  **Curve Calculation**:
    -   Ensure the token amount received corresponds to the `90 USDT` effective payment, not `100 USDT`.

