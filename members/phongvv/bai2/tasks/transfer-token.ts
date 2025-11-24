import type { NewTaskActionFunction } from "hardhat/types/tasks";
import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";
import { parseEther } from "viem";

interface TransferTokenArgs {
  to?: string;
  amount?: string;
}

const transferAction: NewTaskActionFunction<TransferTokenArgs> = async (
  taskArgs,
  hre
) => {
  if (!taskArgs.to || !taskArgs.amount) {
    throw new Error("Both --to and --amount parameters are required");
  }

  const connection = await hre.network.connect();
  const { ignition, viem } = connection;
  const publicClient = await viem.getPublicClient();
  const { token } = await ignition.deploy(TokenModule, {
    parameters,
  });

  const to = taskArgs.to as `0x${string}`;
  const amount = parseEther(taskArgs.amount);

  const tx = await token.write.transfer([to, amount]);
  console.log("transfer tx=", tx);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("transfer success");
};

export const transferTokenTask = task("transfer-token", "Transfer token")
  .addOption({
    name: "to",
    type: ArgumentType.STRING,
    description: "The recipient address",
    defaultValue: "",
  })
  .addOption({
    name: "amount",
    type: ArgumentType.STRING,
    description: "The amount to transfer",
    defaultValue: "0",
  })
  .setAction(async () => ({ default: transferAction }))
  .build();
