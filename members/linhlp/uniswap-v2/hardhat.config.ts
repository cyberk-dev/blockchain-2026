import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import "./plugins/type-extensions.js";

export default defineConfig({
  plugins: [
    hardhatToolboxViemPlugin,
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
      url: "https://eth-sepolia.g.alchemy.com/v2/oHSn32zQQJAtQNGRyvE9i",
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  ignition: {
    requiredConfirmations: 1,
  },
});
