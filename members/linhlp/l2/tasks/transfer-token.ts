import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { parseUnits } from "viem";

import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";
import { ArgumentType } from "hardhat/types/arguments";

export const transferTokenTask = task("transfer-token", "Transfer token")
  .addOption({
    name: "to",
    description: "to who",
    type: ArgumentType.STRING,
    defaultValue: "0x4E60672a8DB169e322dF5B36599c77Bce3383998",
  })
  .addOption({
    name: "amount",
    description: "amount of tokens to transfer",
    type: ArgumentType.STRING,
    defaultValue: "100",
  })
  .setAction(async () => {
    return {
      default: async (
        args: { to?: string; amount?: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(TokenModule, {
          parameters,
        });
        const to = args.to;
        const amount = args.amount;

        const tx = await token.write.transfer([
          to as `0x${string}`,
          parseUnits(amount as string, 18),
        ]);
        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
