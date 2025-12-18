import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";
import "./plugins/type-extensions.js";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { createTokenTask } from "./tasks/create-token.js";
import { addLiquidityTask } from "./tasks/add-liquidity.js";
import { removeLiquidityTask } from "./tasks/remove-liquidity.js";
import { swapExactInTask } from "./tasks/swap-exact-in.js";
import { swapExactOutTask } from "./tasks/swap-exact-out.js";

export default defineConfig({
  plugins: [
    hardhatToolboxViemPlugin,
    hardhatVerify,
    hardhatViemAssertions,
    {
      id: "hardhat-viem-assertions-extended",
      dependencies: () => [],
      hookHandlers: {
        // Load the plugin logic when the network starts
        network: () => import("./plugins/viem-test.js"),
      },
    },
  ],
  tasks: [
    createTokenTask,
    addLiquidityTask,
    removeLiquidityTask,
    swapExactInTask,
    swapExactOutTask,
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
    npmFilesToBuild: [
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
    ],
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
  verify: {
    etherscan: {
      apiKey: "",
    },
  },
});
