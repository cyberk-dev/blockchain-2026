import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      // Default hardhat network (ephemeral, resets each time)
    },
    localhost: {
      // Persistent local network (when running npx hardhat node)
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
};

export default config;

