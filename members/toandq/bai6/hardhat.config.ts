import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import { createTokenTask } from "./tasks/create-token.js";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  tasks: [createTokenTask],
  solidity: {
    npmFilesToBuild: [
      "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol",
      "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol",
      "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol",
      "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol",
      "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol",
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
      '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol',
      '@openzeppelin/contracts/proxy/beacon/IBeacon.sol'
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
