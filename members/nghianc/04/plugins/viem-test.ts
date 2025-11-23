import type { Address, PublicClient } from "viem";
import { erc20Abi } from "viem";

export interface BalanceChange {
  account: Address;
  token: Address;
  before: bigint;
  after: bigint;
  delta: bigint;
}

export interface BalanceAssertion {
  account: Address;
  token: Address;
  delta: bigint;
}

export async function getERC20Balance(
  client: PublicClient,
  token: Address,
  account: Address
): Promise<bigint> {
  return await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

export async function captureBalances(
  client: PublicClient,
  tokens: Address[],
  accounts: Address[]
): Promise<Map<string, bigint>> {
  const balances = new Map<string, bigint>();

  for (const token of tokens) {
    for (const account of accounts) {
      const key = `${token.toLowerCase()}-${account.toLowerCase()}`;
      const balance = await getERC20Balance(client, token, account);
      balances.set(key, balance);
    }
  }

  return balances;
}

export function assertErc20BalancesHaveChanged(
  beforeBalances: Map<string, bigint>,
  afterBalances: Map<string, bigint>,
  assertions: BalanceAssertion[]
): void {
  for (const assertion of assertions) {
    const key = `${assertion.token.toLowerCase()}-${assertion.account.toLowerCase()}`;
    const before = beforeBalances.get(key) ?? 0n;
    const after = afterBalances.get(key) ?? 0n;
    const actualDelta = after - before;

    if (actualDelta !== assertion.delta) {
      throw new Error(
        `ERC20 balance change assertion failed for account ${assertion.account} token ${assertion.token}:\n` +
        `  Expected delta: ${assertion.delta}\n` +
        `  Actual delta: ${actualDelta}\n` +
        `  Before: ${before}\n` +
        `  After: ${after}`
      );
    }
  }
}

export async function withBalanceTracking<T>(
  client: PublicClient,
  tokens: Address[],
  accounts: Address[],
  action: () => Promise<T>,
  assertions: BalanceAssertion[]
): Promise<T> {
  const beforeBalances = await captureBalances(client, tokens, accounts);
  const result = await action();
  const afterBalances = await captureBalances(client, tokens, accounts);

  assertErc20BalancesHaveChanged(beforeBalances, afterBalances, assertions);

  return result;
}
