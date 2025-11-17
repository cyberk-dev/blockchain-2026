import type { NewTaskActionFunction } from "hardhat/types/tasks";
import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import parameters from "../token-parameter.json";
import { parseEther } from "viem";
import TokenFactory from "../ignition/modules/TokenFactory.js";

interface CreateTokenArgs {
  name: string;
  symbol: string;
  supply: string;
}

const createTokenAction: NewTaskActionFunction<CreateTokenArgs> = async (
  taskArgs,
  hre
) => {
  if (!taskArgs.name || !taskArgs.symbol || !taskArgs.supply) {
    throw new Error(
      "Both --name, --symbol and --supply parameters are required"
    );
  }

  const connection = await hre.network.connect();
  const { ignition, viem } = connection;
  const publicClient = await viem.getPublicClient();
  const { tokenFactory } = await ignition.deploy(TokenFactory, {
    parameters,
  });

  const name = taskArgs.name;
  const symbol = taskArgs.symbol;
  const supply = parseEther(taskArgs.supply);

  const tx = await tokenFactory.write.createToken([name, symbol, supply]);
  console.log("create token tx=", tx);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("Tx success");
};

export const createTokenTask = task("create-token", "Create token")
  .addOption({
    name: "name",
    type: ArgumentType.STRING,
    description: "Token name",
    defaultValue: "",
  })
  .addOption({
    name: "symbol",
    type: ArgumentType.STRING,
    description: "Token symbol",
    defaultValue: "",
  })
  .addOption({
    name: "supply",
    type: ArgumentType.STRING,
    description: "The token initial supply",
    defaultValue: "0",
  })
  .setAction(async () => ({ default: createTokenAction }))
  .build();
