import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";
import { parseUnits } from "viem";
import { ArgumentType } from "hardhat/types/arguments";

export const transferTokenTask = task("transfer-token", "Transfer token")
  .addOption({
    name: "to",
    description: "Recipient address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount",
    description: 'Amount in token units (e.g. "1.5")',
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        { to, amount }: { to: string; amount: string; decimals?: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        if (!to) {
          throw new Error("Missing required parameter --to");
        }
        if (!amount) {
          throw new Error("Missing required parameter --amount");
        }
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token }: { token: { write: any } } = await ignition.deploy(
          TokenModule,
          {
            parameters,
          }
        );

        const tokenDecimals = 18;
        const amountInWei = amount.startsWith("0x")
          ? BigInt(amount)
          : parseUnits(amount, tokenDecimals);

        const tx = await token.write.transfer([to, amountInWei]);
        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
