import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import { transferTokenTask } from "./tasks/transfer-token.js";
import { createTokenTask } from "./tasks/create-token.js";
import { listTokensTask } from "./tasks/list-tokens.js";
import { deployFactoryTask } from "./tasks/deploy-factory.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
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
