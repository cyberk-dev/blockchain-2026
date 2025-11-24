import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { defineConfig } from "hardhat/config";
import "./plugins/type-extensions.js";

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
      url: process.env.PUBLIC_RPC_URL || "",
      accounts: process.env.PUBLIC_PRIVATE_KEY ? [process.env.PUBLIC_PRIVATE_KEY] : [],
    },
  },
});
