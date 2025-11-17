import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { parseUnits } from "viem";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

export const createTokenTask = task(
  "create-token",
  "Create a new ERC20 token using TokenFactory"
)
  .addOption({
    name: "name",
    description: "Token name",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "symbol",
    description: "Token symbol",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "supply",
    description: "Initial supply (in tokens, not wei)",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(async () => {
    return {
      default: async (taskArguments, hre: HardhatRuntimeEnvironment) => {
        const { name, symbol, supply } = taskArguments;

        // Validate parameters
        if (!name) {
          throw new Error("Token name (--name) is required");
        }
        if (!symbol) {
          throw new Error("Token symbol (--symbol) is required");
        }
        if (!supply) {
          throw new Error("Initial supply (--supply) is required");
        }

        const supplyNum = parseFloat(supply);
        if (isNaN(supplyNum) || supplyNum <= 0) {
          throw new Error(
            `Invalid supply: ${supply}. Must be a positive number.`
          );
        }

        console.log(
          `Creating token: ${name} (${symbol}) with initial supply of ${supply} tokens...`
        );

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        // Deploy or get TokenFactory
        const { tokenFactory } = await ignition.deploy(TokenFactoryModule);
        console.log(`TokenFactory address: ${tokenFactory.address}`);

        // Convert supply to wei
        const supplyInWei = parseUnits(supply, 18);
        console.log(`Initial supply in wei: ${supplyInWei}`);

        // Create token
        const tx = await tokenFactory.write.createToken([
          name,
          symbol,
          supplyInWei,
        ]);
        console.log(`Transaction hash: ${tx}`);

        // Get the created token address from events
        const receipt = await publicClient.getTransactionReceipt({ hash: tx });
        const logs = await publicClient.getContractEvents({
          address: tokenFactory.address,
          abi: tokenFactory.abi,
          eventName: "TokenCreated",
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });

        if (logs.length === 0) {
          throw new Error("TokenCreated event not found");
        }

        const tokenAddress = logs[0].args.tokenAddress;
        console.log(`✅ Token created successfully!`);
        console.log(`Token address: ${tokenAddress}`);
        console.log(`Creator: ${logs[0].args.creator}`);

        // Get creator's balance
        const token = await viem.getContractAt(
          "Token",
          tokenAddress as `0x${string}`
        );
        const [creator] = await viem.getWalletClients();
        const balance = await token.read.balanceOf([creator.account.address]);

        console.log(`Creator balance: ${balance} wei (${supply} tokens)`);

        return {
          tokenAddress,
          transactionHash: tx,
          name,
          symbol,
          initialSupply: supply,
          initialSupplyWei: supplyInWei.toString(),
          creator: logs[0].args.creator,
        };
      },
    };
  })
  .build();
