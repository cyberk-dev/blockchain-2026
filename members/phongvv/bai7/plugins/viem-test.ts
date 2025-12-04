import type { HookContext, NetworkHooks } from "hardhat/types/hooks";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import assert from "node:assert/strict";
import { parseAbi } from "viem";

const abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (nextContext: HookContext) => Promise<NetworkConnection<ChainTypeT>>
    ) {
      const connection = await next(context);

      connection.viem.assertions.erc20BalancesHaveChanged = async (
        resolvedTxHash,
        token,
        changes,
        diff = 0n
      ) => {
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
                functionName: "balanceOf",
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
              functionName: "balanceOf",
              args: [address],
            })
          )
        );
        changes.forEach(({ address, amount }, index) => {
          const balanceBefore = beforeBalances[index];
          const balanceAfter = afterBalances[index];

          const actualChange = balanceAfter - balanceBefore;

          const delta =
            actualChange > amount
              ? actualChange - amount
              : amount - actualChange;

          assert.ok(
            delta <= diff,
            `For address "${address}", expected balance to change by ${amount} (from ${balanceBefore} to ${
              balanceBefore + amount
            }), but got a change of ${actualChange} instead.`
          );
        });
      };

      return connection;
    },
  };

  return handlers;
};
