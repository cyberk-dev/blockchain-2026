import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import parameters from "../ignition-parameters.json";
import { ArgumentType } from "hardhat/types/arguments";
import { parseEther } from "viem";

export const createTokenTask = task("create-token", "Create token")
  .addOption({
    name: "name",
    type: ArgumentType.STRING,
    description: "The name of the token",
    defaultValue: "MarkD",
  })
  .addOption({
    name: "symbol",
    type: ArgumentType.STRING,
    description: "The symbol of the token",
    defaultValue: "GSD",
  })
  .addOption({
    name: "a",
    type: ArgumentType.BIGINT,
    description: "Bonding curve slope",
    defaultValue: 1n,
  })
  .addOption({
    name: "b",
    type: ArgumentType.BIGINT,
    description: "Bonding curve intercept",
    defaultValue: 12n,
  })
  .addOption({
    name: "saleDuration",
    type: ArgumentType.BIGINT,
    description: "Duration of the token sale in seconds",
    defaultValue: 3600n,
  })
  .addOption({
    name: "paymentToken",
    type: ArgumentType.STRING,
    description: "Address of the payment token (ERC20 like USDT)",
    defaultValue: "",
  })
  .addOption({
    name: "buyFeePercent",
    type: ArgumentType.BIGINT,
    description: "Buy fee percentage (e.g., 5 for 5%)",
    defaultValue: 5n,
  })
  .addOption({
    name: "creationFee",
    type: ArgumentType.STRING,
    description: "Creation fee in ETH (e.g., '0.01')",
    defaultValue: "0.01",
  })

  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { factory } = await ignition.deploy(TokenFactoryModule, {
          parameters,
        });

        const {
          name,
          symbol,
          a,
          b,
          saleDuration,
          paymentToken,
          buyFeePercent,
          creationFee,
        } = _;

        const tx = await factory.write.createToken(
          [name, symbol, a, b, saleDuration],
          {
            value: parseEther(creationFee),
          }
        );
        console.log("create token tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("create token success");
      },
    };
  })
  .build();
