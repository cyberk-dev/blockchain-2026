import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";

export const transferTokenTask = task("transfer-token", "Transfer token")
  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(TokenModule, {
          parameters,
        });

        const tx = await token.write.transfer([
          "0x94EAA1Ca44436412C425D77F227151dFBfF76705",
          1000n,
        ]);
        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
