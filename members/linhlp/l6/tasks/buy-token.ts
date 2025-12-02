import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../ignition-parameters.json";
import { ArgumentType } from "hardhat/types/arguments";
import { parseUnits } from "viem";

export const buyTokenTask = task("buy-token", "Buy token")
  .addOption({
    name: "amount",
    type: ArgumentType.STRING,
    description:
      'Amount of tokens to buy (in whole units, e.g., "1" for 1 token)',
    defaultValue: "1",
  })
  .addOption({
    name: "tokenAddress",
    type: ArgumentType.STRING,
    description:
      "Address of the token contract (leave empty to deploy from Ignition)",
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const { amount, tokenAddress } = _;

        let token;
        if (tokenAddress) {
          token = await viem.getContractAt(
            "Token",
            tokenAddress as `0x${string}`
          );
        } else {
          const deployed = await ignition.deploy(TokenModule, { parameters });
          token = deployed.token;
        }

        const amountInWei = parseUnits(amount, 18);

        const tx = await token.write.buyToken([amountInWei]);
        console.log("buy tx=", tx);

        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("buy success");
      },
    };
  })
  .build();
