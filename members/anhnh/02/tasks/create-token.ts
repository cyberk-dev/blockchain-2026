import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import { parseUnits } from "viem";
import { ArgumentType } from "hardhat/types/arguments";

export const createTokenTask = task("create-token", "Create a new ERC20 via factory")
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
    description: 'Initial supply in token units (e.g. "1000000")',
    type: ArgumentType.STRING,
    defaultValue: "1000000",
  })
  .setAction(async () => {
    return {
      default: async (
        { name, symbol, supply }: { name: string; symbol: string; supply: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        if (!name) throw new Error("Missing required parameter --name");
        if (!symbol) throw new Error("Missing required parameter --symbol");

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [walletClient] = await viem.getWalletClients();
        const deployer = walletClient.account;

        const { factory }: { factory: { address: `0x${string}`; read: any; write: any } } =
          await ignition.deploy(TokenFactoryModule, {});

        const decimals = 18;
        const supplyWei = supply.startsWith("0x") ? BigInt(supply) : parseUnits(supply, decimals);

        console.log("Factory at:", factory.address);
        const tx = await factory.write.createToken([name, symbol, supplyWei], { account: deployer });
        console.log("createToken tx:", tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("createToken mined:", receipt.transactionHash);
      },
    };
  })
  .build();


