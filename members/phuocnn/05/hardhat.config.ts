import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";
import "./plugins/type-extensions.js";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import "dotenv/config";

export default defineConfig({
  plugins: [
    hardhatToolboxViemPlugin,
    hardhatVerify,
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
      url: process.env.RPC_URL || "",
      accounts: [process.env.PRIVATE_KEY || ""],
      chainId: 11155111,
    },
  },
  verify: {
    etherscan: {
      apiKey: "",
    },
  },
});
