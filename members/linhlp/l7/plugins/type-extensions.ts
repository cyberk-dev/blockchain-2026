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
