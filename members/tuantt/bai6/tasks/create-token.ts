import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress, parseEther, decodeEventLog } from "viem";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";
import parameters from "../ignition/parameters.json";

// npx hardhat create-token --name "MyToken" --symbol "MTK" --network sepolia
export const createTokenTask = task(
  "create-token",
  "Create a new token through TokenFactory"
)
  .addOption({
    name: "name",
    description: "The name of the token",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "symbol",
    description: "The symbol of the token",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "usdt",
    description:
      "The USDT contract address (if empty, will use USDT from deployment)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "factory",
    description:
      "The TokenFactory contract address (if empty, will deploy new or load from ignition)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          name: string;
          symbol: string;
          usdt: string;
          factory: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const {
          name,
          symbol,
          usdt: usdtAddress,
          factory: factoryAddress,
        } = taskArgs;

        if (!name || !symbol) {
          throw new Error("Both --name and --symbol are required");
        }

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        console.log("Interacting with account:", deployer.account.address);

        let factory;
        let usdt;

        // Load or deploy factory
        if (factoryAddress) {
          const factoryAddr = getAddress(factoryAddress) as `0x${string}`;
          console.log(`Using factory address: ${factoryAddr}`);
          factory = await viem.getContractAt("TokenFactory", factoryAddr);
        } else {
          console.log("Loading factory from ignition deployment...");
          const deployed = await ignition.deploy(TokenFactoryWithBeaconModule, {
            parameters,
          });
          factory = deployed.factory;
          usdt = deployed.usdt;
          console.log(`Factory address: ${factory.address}`);
          console.log(`USDT address: ${usdt.address}`);
        }

        // Load USDT if not already loaded
        if (!usdt) {
          if (usdtAddress) {
            const usdtAddr = getAddress(usdtAddress) as `0x${string}`;
            usdt = await viem.getContractAt("USDT", usdtAddr);
          } else {
            // Load from deployment
            const deployed = await ignition.deploy(
              TokenFactoryWithBeaconModule,
              {
                parameters,
              }
            );
            usdt = deployed.usdt;
          }
        }

        const TOKEN_CREATION_FEE = parseEther("0.01");
        console.log(`\nCreating token: ${name} (${symbol})...`);
        console.log(`Token creation fee: ${TOKEN_CREATION_FEE} ETH`);
        console.log(`USDT address: ${usdt.address}`);

        const txHash = await factory.write.createToken(
          [name, symbol, usdt.address],
          {
            value: TOKEN_CREATION_FEE,
            account: deployer.account,
          }
        );

        console.log("Transaction hash:", txHash);
        console.log("Waiting for confirmation...");

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        console.log("Token created successfully!");

        // Get token address from event
        const createEventLogs = receipt.logs
          .map((log) => {
            try {
              return decodeEventLog({
                abi: factory.abi,
                data: log.data,
                topics: log.topics,
              });
            } catch {
              return null;
            }
          })
          .filter((decoded) => decoded?.eventName === "TokenCreated");

        if (createEventLogs.length > 0) {
          const tokenAddress = (createEventLogs[0]?.args as any)?.tokenAddress;
          console.log(
            `\n✅ Token created successfully! Token address: ${tokenAddress}`
          );
          return tokenAddress;
        } else {
          console.log("\n⚠️  No TokenCreated event found");
          return null;
        }
      },
    };
  })
  .build();
