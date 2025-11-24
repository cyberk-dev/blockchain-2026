import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { configVariable, defineConfig } from "hardhat/config";
import { transferTokenTask } from "./tasks/transfer-token.js";
import { createTokenTask } from "./tasks/create-token.js";
import { listTokensTask } from "./tasks/list-tokens.js";
import { deployFactoryTask } from "./tasks/deploy-factory.js";
import '@nomicfoundation/hardhat-viem';
import {  Address, GetContractReturnType, Hash } from 'viem';

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
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin,
    hardhatViemAssertions,
    hardhatNetworkHelpers,  
    {
    id: 'hardhat-viem-assertions-extended',
    dependencies: () => [],
    hookHandlers: {
      // Load the plugin logic when the network starts
      network: () => import('./plugins/viem-test.js'),
    },
  },],
  tasks: [transferTokenTask, createTokenTask, listTokensTask, deployFactoryTask],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  ignition: {
    requiredConfirmations: 1
  }
});
