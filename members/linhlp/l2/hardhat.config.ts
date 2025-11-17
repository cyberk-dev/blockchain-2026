import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import { transferTokenTask } from "./tasks/transfer-token.js";
import { createTokenTask } from "./tasks/create-token.js";
import { upgradeEventEmitterTask } from "./tasks/upgrade-event-emitter.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  tasks: [transferTokenTask, createTokenTask, upgradeEventEmitterTask],
  solidity: {
    npmFilesToBuild: ["@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"],
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
