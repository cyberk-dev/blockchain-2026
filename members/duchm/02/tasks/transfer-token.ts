import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import parameters from "../parameters.json";
import TokenModule from "../ignition/modules/Token.js";
export const transferTokenTask = task("transfer-token", "Transfer token")
  .setAction(async () => {
    return {
      default: async (o, hre: HardhatRuntimeEnvironment) => {
        const { viem, ignition } = await hre.network.connect();
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(TokenModule, { parameters });

        const tx = await token.write.transfer([
          "0x10e760e7874e0d949161b9dfaae6d98a4c82a910",
          100000n,
        ]);
        console.log(">>>tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
      },
    };
  })
  .build();
