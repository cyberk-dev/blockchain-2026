# Exercise 4: Bonding Curve & Advanced Testing

This exercise builds upon the work in Exercise 3. You will refine the bonding curve implementation, switch to ERC20 payments, and perform advanced testing using custom Hardhat plugins.

## 1. Bonding Curve Formula

Implement the linear pricing formula:

$$ y = ax + b $$

Where:
- $y$: Price of the token at supply $x$.
- $x$: Current token supply.
- $a$: Slope coefficient.
- $b$: Initial price intercept.

### Task
- Determine appropriate values for $a$ and $b$ so that the price of the **1st token** is approximately `0.00005 ETH` (or equivalent in the payment currency).
- Example starting point: $a = \frac{1}{10^{22}}$, $b = \frac{12}{10^{22}}$.
- **Reference:** [WolframAlpha Calculation](https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D)

## 2. Testing

Verify your implementation with the following requirements.

### View Function
Ensure your contract has a public view function to calculate costs off-chain or for verification:

```solidity
function getCost(uint256 s, uint256 m, uint256 _a, uint256 _b) public view returns (uint256);
```
- `s`: Current supply.
- `m`: Amount to buy.
- `_a`, `_b`: Curve parameters.

### Test Scenarios
1.  **Price Check (First Token):** Verify the cost of purchasing the very first token.
2.  **Price Check (Batch):** Verify the cost of purchasing the next 10 tokens.
3.  **Purchase Execution:** Execute a `buyToken` transaction and verify it succeeds.
4.  **Events & Balances:**
    - Ensure `TokenBought` (or similar) events are emitted using `emitWithArgs`.
    - Verify balance changes for the buyer and the contract.

## 3. Switch to ERC20 Payment

Refactor your contract to use an ERC20 token (e.g., USDT) for payment instead of native ETH.

1.  **Mock Token:** Create and deploy a Mock USDT ERC20 token.
2.  **Buy Logic:** Update `buyToken` to `transferFrom` the payment token from the user to the contract/treasury.

## 4. Advanced Testing: Custom Plugins

To effectively test ERC20 balance changes (similar to how `changeEtherBalance` works for ETH), we will use a custom Hardhat plugin: `erc20BalancesHaveChanged`.

### Guideline: Adding Custom Plugins to `hardhat.config.ts`

We have added a custom plugin to extending `hardhat-viem` assertions. Here is how it works:

**1. Plugin Implementation (`plugins/viem-test.ts`)**
Create `plugins/viem-test.ts` with the following content. This script hooks into the Hardhat network to read `balanceOf` before and after transactions.

```typescript
import type { HookContext, NetworkHooks } from 'hardhat/types/hooks';
import type { ChainType, NetworkConnection } from 'hardhat/types/network';
import assert from 'node:assert/strict';
import { parseAbi } from 'viem';

// const abi = [
//   {
//     inputs: [],
//     name: 'balanceOf',
//     outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
//     stateMutability: 'view',
//     type: 'function',
//   },
// ];

const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (nextContext: HookContext) => Promise<NetworkConnection<ChainTypeT>>
    ) {
      const connection = await next(context);

      connection.viem.assertions.erc20BalancesHaveChanged = async (resolvedTxHash, token, changes, diff = 0n) => {
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();

        const tokenAddress = (token as any)?.address || token;

        const hash = await resolvedTxHash;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const beforeBalances = await Promise.all(
          changes.map(async ({ address }) => {
            const balance = BigInt(
              await publicClient.readContract({
                abi,
                address: tokenAddress,
                functionName: 'balanceOf',
                args: [address],
                blockNumber: receipt.blockNumber - 1n,
              })
            );
            return balance;
          })
        );
        const afterBalances = await Promise.all(
          changes.map(({ address }) =>
            publicClient.readContract({
              abi,
              address: (token as any)?.address || token,
              functionName: 'balanceOf',
              args: [address],
            })
          )
        );
        changes.forEach(({ address, amount }, index) => {
          const balanceBefore = beforeBalances[index];
          const balanceAfter = afterBalances[index];

          const actualChange = balanceAfter - balanceBefore;

          const delta = actualChange > amount ? actualChange - amount : amount - actualChange;

          assert.ok(
            delta <= diff,
            `For address "${address}", expected balance to change by ${amount} (from ${balanceBefore} to ${balanceBefore + amount}), but got a change of ${actualChange} instead.`
          );
        });
      };

      return connection;
    },
  };

  return handlers;
};
```

**2. Type Definitions (`plugins/type-extensions.ts`)**
Create `plugins/type-extensions.ts` to extend the TypeScript interface for `HardhatViemAssertions`.

```typescript
import '@nomicfoundation/hardhat-viem';
import { Account, Address, GetContractReturnType, Hash } from 'viem';

declare module '@nomicfoundation/hardhat-viem-assertions/types' {
  interface HardhatViemAssertions {
    erc20BalancesHaveChanged: (
      resolvedTxHash: Promise<Hash>,
      token: `0x${string}` | GetContractReturnType,
      changes: Array<{
        address: Address;
        amount: bigint;
      }>,
      delta?: bigint
    ) => Promise<void>;
  }
}
```

**3. Configuration (`hardhat.config.ts`)**
To activate the plugin, it must be registered in the Hardhat config:

```typescript
import { defineConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import './plugins/type-extensions.js'; // Import the type extensions

export default defineConfig({
  plugins: [
    hardhatToolboxViemPlugin,
    hardhatViemAssertions,
    // Register the custom plugin
    {
      id: 'hardhat-viem-assertions-extended',
      dependencies: () => [],
      hookHandlers: {
        // Load the plugin logic when the network starts
        network: () => import('./plugins/viem-test.js'),
      },
    },
  ],
  // ... rest of config
});
```

### Usage in Tests

```typescript
import { expect } from "chai";

// ... inside your test
await expect(hash).to.be.confirmed;

// Check if buyer lost 'cost' and contract gained 'cost'
await expect(hash).to.erc20BalancesHaveChanged(usdtAddress, [
  { address: buyerAddress, amount: -cost },
  { address: contractAddress, amount: cost }
]);
```
