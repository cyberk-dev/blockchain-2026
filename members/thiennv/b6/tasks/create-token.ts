import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

export const createTokenTask = task(
  "create-token",
  "Create token via TokenFactory"
)
  .addOption({
    name: "name",
    description: "Token name",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "symbol",
    description: "Token symbol",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "paymentToken",
    description: "Payment token address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "treasury",
    description: "Treasury address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "endTime",
    description: "Sale end timestamp (unix seconds)",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .addOption({
    name: "slope",
    description: "Bonding curve slope",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .addOption({
    name: "basePrice",
    description: "Base price",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .addOption({
    name: "feeBps",
    description: "Fee in basis points",
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(async () => {
    return {
      default: async (
        args: {
          name: string;
          symbol: string;
          paymentToken: string;
          treasury: string;
          endTime: bigint;
          slope: bigint;
          basePrice: bigint;
          feeBps: bigint;
        },
        hre: HardhatRuntimeEnvironment,
      ) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const [deployer] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();

        console.log("Using account:", deployer.account.address);

        const { factory } = await ignition.deploy(TokenFactoryModule);
        console.log("Factory address:", factory.address);

        const txHash = await factory.write.create(
          [
            args.name,
            args.symbol,
            args.paymentToken as `0x${string}`,
            args.treasury as `0x${string}`,
            args.endTime,
            args.slope,
            args.basePrice,
            args.feeBps,
          ],
          {
            account: deployer.account,
          },
        );

        console.log("createToken tx:", txHash);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Token created");
        return txHash;
      },
    };
  })
  .build();
