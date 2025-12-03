import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress, decodeEventLog } from "viem";

const FACTORY_ADDRESS = "0x1Aa0533e049bBeF8C34Bc73E97BB1cA82D79d7ff";

export const createTokenTask = task("create-token", "Creates a new token using the Factory")
  .addOption({
    name: "name",
    description: "The name of the new token",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "symbol",
    description: "The symbol of the new token",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "a",
    description: "Slope parameter for bonding curve (e.g., 1)",
    type: ArgumentType.STRING,
    defaultValue: "1",
  })
  .addOption({
    name: "b",
    description: "Initial price parameter for bonding curve (e.g., 0)",
    type: ArgumentType.STRING,
    defaultValue: "0",
  })
  .addOption({
    name: "buyFeePercent",
    description: "Buy fee percentage (e.g., 5 for 5%)",
    type: ArgumentType.STRING,
    defaultValue: "5",
  })
  .addOption({
    name: "factory",
    description: "The address of the TokenFactory contract",
    type: ArgumentType.STRING,
    defaultValue: FACTORY_ADDRESS,
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: { name: string; symbol: string; a: string; b: string; buyFeePercent: string; factory: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        if (!taskArgs.name || !taskArgs.symbol) {
          throw new Error("Both --name and --symbol parameters are required");
        }

        if (!taskArgs.factory) {
          throw new Error("--factory parameter is required");
        }

        const connection = await hre.network.connect();
        const { viem } = connection;
        const [deployer] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();

        console.log("Interacting with account:", deployer.account.address);

        const factoryAddress = getAddress(taskArgs.factory) as `0x${string}`;
        console.log(`Using factory address: ${factoryAddress}`);

        const factory = await viem.getContractAt("TokenFactory", factoryAddress);

        const a = BigInt(taskArgs.a);
        const b = BigInt(taskArgs.b);
        const buyFeePercent = BigInt(taskArgs.buyFeePercent);

        const creationFee = await factory.read.creationFee();

        console.log(`Creating token: ${taskArgs.name} (${taskArgs.symbol})...`);
        console.log(`Parameters: a=${a}, b=${b}, buyFeePercent=${buyFeePercent}%`);
        console.log(`Creation fee: ${creationFee} wei`);

        const txHash = await factory.write.createToken(
          [taskArgs.name, taskArgs.symbol, a, b, buyFeePercent],
          { value: creationFee, account: deployer.account }
        );

        console.log("Transaction hash:", txHash);
        console.log("Waiting for confirmation...");

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Token created successfully!");

        const createEventLogs = receipt.logs
          .map((log) => {
            try {
              return decodeEventLog({
                abi: factory.abi,
                data: log.data,
                topics: log.topics,
              });
            } catch (e) {
              return null;
            }
          })
          .filter((evt) => evt && evt.eventName === "TokenCreated");

        if (createEventLogs.length > 0) {
          const event = createEventLogs[0] as any;
          console.log(`Token address: ${event.args.tokenAddress}`);
          console.log(`Creator: ${event.args.creator}`);
        }
      },
    };
  })
  .build();

