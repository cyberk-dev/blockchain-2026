import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import { ArgumentType } from "hardhat/types/arguments";

const erc20MinimalAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
];

export const listTokensTask = task("list-tokens", "List tokens created by the factory")
  .addOption({
    name: "creator",
    description: "Optional creator address; if omitted, lists all tokens",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        { creator }: { creator?: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const { factory }: { factory: { address: `0x${string}`; read: any } } =
          await ignition.deploy(TokenFactoryModule, {});

        let tokenAddresses: `0x${string}`[] = [];
        if (creator && creator !== "") {
          tokenAddresses = await factory.read.getCreatorTokens([creator]);
          console.log(`Creator ${creator} has ${tokenAddresses.length} token(s):`);
        } else {
          tokenAddresses = await factory.read.getAllTokens();
          console.log(`All tokens (${tokenAddresses.length}):`);
        }

        for (const addr of tokenAddresses) {
          try {
            const [name, symbol, decimals] = await Promise.all([
              publicClient.readContract({ address: addr, abi: erc20MinimalAbi, functionName: "name" }) as Promise<string>,
              publicClient.readContract({ address: addr, abi: erc20MinimalAbi, functionName: "symbol" }) as Promise<string>,
              publicClient.readContract({ address: addr, abi: erc20MinimalAbi, functionName: "decimals" }) as Promise<number>,
            ]);
            console.log(`- ${addr} | ${name} (${symbol}) | decimals=${decimals}`);
          } catch (e) {
            console.log(`- ${addr} | <unable to query ERC20 metadata>`);
          }
        }
      },
    };
  })
  .build();


