import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { configVariable, defineConfig } from "hardhat/config";
import "./plugins/type-extensions.js";
import { createTokenTask } from "./tasks/create-token.js";

export default defineConfig({
  plugins: [
    hardhatToolboxViemPlugin,
    hardhatViemAssertions,
    {
      id: "hardhat-viem-assertions-extended",
      dependencies: () => [],
      hookHandlers: {
        network: () => import("./plugins/viem-test.js"),
      },
    },
  ],
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
  tasks: [createTokenTask],
});
