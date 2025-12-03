import type { HookContext, NetworkHooks } from 'hardhat/types/hooks';
import type { ChainType, NetworkConnection } from 'hardhat/types/network';
import assert from 'node:assert/strict';
import { parseAbi, type Address, type Hash, type GetContractReturnType } from 'viem';
import './type-extensions';

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

      // @ts-expect-error - Type extension được define trong type-extensions.ts
      connection.viem.assertions.erc20BalancesHaveChanged = async (
        resolvedTxHash: Promise<Hash>,
        token: `0x${string}` | GetContractReturnType,
        changes: Array<{ address: Address; amount: bigint }>,
        diff: bigint = 0n
      ) => {
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();

        const tokenAddress = (token as any)?.address || token;

        const hash = await resolvedTxHash;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        const beforeBalances = await Promise.all(
          changes.map(async ({ address }: { address: Address }) => {
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
          changes.map(async ({ address }: { address: Address }) => {
            const balance = BigInt(
              await publicClient.readContract({
                abi,
                address: (token as any)?.address || token,
                functionName: 'balanceOf',
                args: [address],
              })
            );
            return balance;
          })
        );
        changes.forEach(({ address, amount }: { address: Address; amount: bigint }, index: number) => {
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
