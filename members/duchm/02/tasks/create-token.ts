import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import { decodeEventLog, parseUnits } from "viem";

export const createTokenTask = task("create-token", "Create token")
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
    name: "totalSupply",
    description: "Token total supply",
    type: ArgumentType.BIGINT,
    defaultValue: parseUnits("100000", 18),
  })
  .setAction(async () => {
    return {
      default: async (args, hre: HardhatRuntimeEnvironment) => {
        if (!args.name || !args.symbol || !args.totalSupply) {
          throw new Error("Missing required arguments");
        }

        const { viem, ignition } = await hre.network.connect();
        const publicClient = await viem.getPublicClient();
        const { tokenFactory } = await ignition.deploy(TokenFactoryModule);
        const factory = await viem.getContractAt(
          "TokenFactory",
          tokenFactory.address
        );

        const tx = await factory.write.createToken([
          args.name,
          args.symbol,
          BigInt(args.totalSupply),
        ]);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        console.log("Transaction hash=", receipt.transactionHash);

        const events = await publicClient.getContractEvents({
          address: factory.address,
          abi: factory.abi,
          eventName: "TokenCreated",
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
          strict: true,
        });

        const tokenAddress = events[0]?.args?.tokenAddress ?? "0x0";

        console.log("Token address=", tokenAddress);

        return tokenAddress;
      },
    };
  })
  .build();
