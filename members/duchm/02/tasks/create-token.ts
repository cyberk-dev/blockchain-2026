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

        const tokenCreatedLog = receipt.logs.find(
          (log) => log.address.toLowerCase() === factory.address.toLowerCase()
        );

        if (!tokenCreatedLog) {
          throw new Error("TokenCreated event not found");
        }
        const decoded = decodeEventLog({
          abi: factory.abi,
          data: tokenCreatedLog.data,
          topics: tokenCreatedLog.topics,
        });

        const tokenAddress = decoded.args.tokenAddress as `0x${string}`;

        console.log("Token address=", tokenAddress);

        return tokenAddress;
      },
    };
  })
  .build();
