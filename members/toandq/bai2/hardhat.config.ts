import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import { transferTokenTask } from "./tasks/transfer-token.js";
import { upgradeTask } from "./tasks/upgrade-token-factory.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  tasks: [transferTokenTask, upgradeTask],
  solidity: {
    npmFilesToBuild: [
      "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol",
      "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol",
      "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol",
      "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol",
      "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol",
    ],
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
});
