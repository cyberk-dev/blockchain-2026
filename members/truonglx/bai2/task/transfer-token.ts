import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";

export const transferTokenTask = task("transfer-token", "Transfer token")
  .setAction(async () => {
    return {
      default: async (args: any, hre: HardhatRuntimeEnvironment) => {
        let to: string | undefined;
        let amount: string | undefined;

        // Check if args contains the parameters
        if (args && typeof args === "object") {
          to = args.to;
          amount = args.amount;
        }

        // Usage: TRANSFER_TO=0x... TRANSFER_AMOUNT=1000 npx hardhat transfer-token
        if (!to) {
          to = process.env.TRANSFER_TO;
        }
        if (!amount) {
          amount = process.env.TRANSFER_AMOUNT;
        }

        if (!to) {
          throw new Error(
            "Missing required parameter 'to'. Set TRANSFER_TO environment variable.\n" +
              "Usage: TRANSFER_TO=0x... TRANSFER_AMOUNT=1000 npx hardhat transfer-token"
          );
        }
        if (!amount) {
          throw new Error(
            "Missing required parameter 'amount'. Set TRANSFER_AMOUNT environment variable.\n" +
              "Usage: TRANSFER_TO=0x... TRANSFER_AMOUNT=1000 npx hardhat transfer-token"
          );
        }

        const toAddress = to as `0x${string}`;
        const amountBigInt = BigInt(amount);

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(TokenModule, {
          parameters,
        });

        console.log(`Transferring ${amountBigInt} tokens to ${toAddress}`);

        const tx = await token.write.transfer([toAddress, amountBigInt]);
        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
