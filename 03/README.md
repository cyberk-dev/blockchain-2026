# Exercise 3: Complete the `buy` function in the Token contract

## Requirements

In this exercise, we will complete the `buy` function in the `Token.sol` smart contract. This function needs to be upgraded to limit the purchase time and have a progressive pricing mechanism.

### 1. Add a time limit for token purchase (`endTime`) (Difficulty: ★☆☆)

-   Add an `endTime` variable (of type `uint256`) to the `Token` contract.
-   The value of `endTime` should be set when the contract is deployed, for example, 1 hour after the deployment time.
-   Create a `modifier` to check if the current time (`block.timestamp`) has exceeded `endTime`.
-   Apply this `modifier` to the `buy` function to prevent users from buying tokens after the allowed time has ended.

### 2. Update token price according to the formula `y = ax + b` (Difficulty: ★★★)

The price of the token will not be fixed but will increase gradually according to the number of tokens already sold.

-   `y`: is the price of the token to be purchased.
-   `x`: is the total number of tokens already sold (including the amount purchased in the current transaction).
-   `a`: is the slope, determining the rate of price increase.
-   `b`: is the starting price of the token.

**Implementation suggestion:**

-   In the `buy` function, you need to calculate the total cost based on the number of tokens the user wants to buy.
-   Since the price of each token changes, you need to calculate the price for each token one by one or use the formula for the sum of an arithmetic progression to calculate the total cost.
-   For example, if a user buys `N` tokens, and `S` tokens have been sold so far:
    -   The price of the `S + 1`-th token is `a * (S + 1) + b`.
    -   The price of the `S + 2`-th token is `a * (S + 2) + b`.
    -   ...
    -   The price of the `S + N`-th token is `a * (S + N) + b`.
-   The total amount the user has to pay (`msg.value`) must be sufficient to buy `N` tokens at the calculated price.
-   Use the `FullMath.sol` library to avoid overflow/underflow errors when performing calculations, especially when multiplying large numbers.
-   **Hint for the general formula**: [WolframAlpha](https://www.wolframalpha.com/input?i2d=true&i=Sum%5Bax+%2B+b%2C%7Bx%2Cs%2B1%2Cs%2Bm%7D%5D)

## Goals to achieve

-   Understand and apply `modifier` in Solidity.
-   Work with `block.timestamp`.
-   Implement complex dynamic pricing logic.
-   Use a safe math library (`FullMath`).
-   Write test cases to check the new features.
