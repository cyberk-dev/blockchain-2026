import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryV2Module from "../ignition/modules/TokenFactoryV2.js";

export const upgradeTokenFactory = task(
  "upgrade-token-factory",
  "Upgrade token factory"
)
  .addOption({
    name: "proxyAddress",
    description: "Proxy address",
    type: ArgumentType.STRING,
    defaultValue: "0x0",
  })
  .setAction(async () => {
    return {
      default: async (args, hre: HardhatRuntimeEnvironment) => {
        if (args.proxyAddress === "0x0") {
          throw new Error("Missing required arguments");
        }

        const { viem, ignition } = await hre.network.connect();
        const publicClient = await viem.getPublicClient();

        const { tokenFactoryV2 } = await ignition.deploy(TokenFactoryV2Module);
        const factoryV2Impl = await viem.getContractAt(
          "TokenFactoryV2",
          tokenFactoryV2.address
        );

        const factory = await viem.getContractAt(
          "TokenFactory",
          args.proxyAddress as `0x${string}`
        );

        // Upgrade proxy to V2
        const [walletClient] = await viem.getWalletClients();
        // Upgrade proxy using writeContract with inline ABI
        const tx = await walletClient.writeContract({
          address: factory.address as `0x${string}`,
          abi: [
            {
              inputs: [
                {
                  internalType: "address",
                  name: "newImplementation",
                  type: "address",
                },
                { internalType: "bytes", name: "data", type: "bytes" },
              ],
              name: "upgradeToAndCall",
              outputs: [],
              stateMutability: "nonpayable",
              type: "function",
            },
          ],
          functionName: "upgradeToAndCall",
          args: [factoryV2Impl.address, "0x"],
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        console.log(`Transaction=`, receipt.transactionHash);

        // Verify version
        const factoryV2 = await viem.getContractAt(
          "TokenFactoryV2",
          args.proxyAddress as `0x${string}`
        );
        const version = await factoryV2.read.getVersion();
        console.log(`Version=`, version);
      },
    };
  })
  .build();
