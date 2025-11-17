import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";
import { ArgumentType } from "hardhat/types/arguments";

export const transferTokenTask = task(
  "transfer-token",
  "Transfer tokens to an address"
)
  .addOption({
    name: "to",
    description: "Who is receiving the greeting.",
    type: ArgumentType.STRING,
    defaultValue: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
  })
  .addOption({
    name: "amount",
    description: "The amount of tokens to transfer.",
    type: ArgumentType.BIGINT,
    defaultValue: 1000n,
  })
  .setAction(async () => {
    return {
      default: async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        const { to, amount } = taskArgs;
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const { token } = await ignition.deploy(TokenModule, {
          parameters: parameters,
        });

        console.log("Token deployed at:", token.address);

        const tx = await token.write.transfer([to as `0x${string}`, amount]);

        console.log("Transfer transaction hash:", tx);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        console.log("Transfer transaction receipt:", receipt);
      },
    };
  })
  .build();
