import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress, parseEther, decodeEventLog } from "viem";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";
import parameters from "../ignition/parameters.json";

// npx hardhat create-token --name "MyToken" --symbol "MTK" --network sepolia
export const createTokenTask = task(
  "create-token",
  "Create a new LPToken (pair) through TokenFactory"
)
  .addOption({
    name: "token0",
    description: "Token0 address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "token1",
    description: "Token1 address",
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
          token0: string;
          token1: string;
          factory: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { token0, token1, factory: factoryAddress } = taskArgs;

        if (!token0 || !token1) {
          throw new Error("Both --token0 and --token1 are required");
        }

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        console.log("Interacting with account:", deployer.account.address);

        let factory;
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
          console.log(`Factory address: ${factory.address}`);
        }

        const token0Addr = getAddress(token0) as `0x${string}`;
        const token1Addr = getAddress(token1) as `0x${string}`;

        const TOKEN_CREATION_FEE = parseEther("0.01");
        console.log(`\nCreating LPToken for pair:`);
        console.log(`- token0: ${token0Addr}`);
        console.log(`- token1: ${token1Addr}`);
        console.log(`Token creation fee: ${TOKEN_CREATION_FEE} ETH`);

        const txHash = await factory.write.createToken(
          [token0Addr, token1Addr],
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
