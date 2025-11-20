import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { parseUnits, decodeEventLog } from "viem";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

const TokenCreatedEventAbi = {
  anonymous: false,
  inputs: [
    { indexed: true, name: "token", type: "address" },
    { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "name", type: "string" },
    { indexed: false, name: "symbol", type: "string" },
    { indexed: false, name: "initialSupply", type: "uint256" },
  ],
  name: "TokenCreated",
  type: "event",
} as const;

export const createTokenTask = task(
  "create-token",
  "Create a new token using TokenFactory"
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
    name: "supply",
    description: "Initial token supply (in whole tokens, e.g. 1000000)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "price",
    description: "Initial token supply (in whole tokens, e.g. 1000000)",
    type: ArgumentType.STRING,
    defaultValue: "0.001",
  })
  .setAction(async () => {
    return {
      default: async (
        args: {
          name?: string;
          symbol?: string;
          supply?: string;
          price?: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        if (!args.name || !args.symbol) {
          throw new Error("Name and symbol are required");
        }

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const deployment = await ignition.deploy(TokenFactoryModule);
        const factory = deployment.factory as any;

        const supply = args.supply || "1000000";
        const initialSupply = parseUnits(supply, 18);
        const price = args.price || 0.001;

        const tx = await factory.write.createToken([
          args.name!,
          args.symbol!,
          initialSupply,
          price,
        ]);

        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
