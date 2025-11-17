import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { parseUnits, isAddress } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";

export const transferTokenTask = task("transfer-token", "Transfer token to a specified address")
  .addOption({
    name: "to",
    description: "Recipient address",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .addOption({
    name: "amount",
    description: "Amount to transfer (in tokens, not wei)",
    type: ArgumentType.STRING_WITHOUT_DEFAULT,
    defaultValue: undefined,
  })
  .setAction(async () => {
    return {
      default: async (taskArguments, hre: HardhatRuntimeEnvironment) => {
        const { to, amount } = taskArguments;

        // Validate recipient address
        if (!to) {
          throw new Error("Recipient address (--to) is required");
        }
        if (!isAddress(to)) {
          throw new Error(`Invalid recipient address: ${to}`);
        }

        // Validate amount
        if (!amount) {
          throw new Error("Amount (--amount) is required");
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error(`Invalid amount: ${amount}. Must be a positive number.`);
        }

        console.log(`Transferring ${amount} tokens to ${to}...`);

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        // Deploy or get existing token contract
        const { token } = await ignition.deploy(TokenModule, {
          parameters,
        });

        console.log(`Token contract: ${token.address}`);

        // Convert amount from tokens to wei (18 decimals)
        const amountInWei = parseUnits(amount, 18);
        console.log(`Amount in wei: ${amountInWei}`);

        // Execute transfer
        const tx = await token.write.transfer([to, amountInWei]);
        console.log(`Transfer transaction hash: ${tx}`);

        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("Transfer successful!");

        return {
          transactionHash: tx,
          recipient: to,
          amount: amount,
          amountInWei: amountInWei.toString(),
        };
      },
    };
  })
  .build();
