import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import parameters from "../token-parameter.json";
import TokenModule from "../ignition/modules/Token.js";
import { parseUnits, getAddress } from "viem";

export const transferTokenTask = task("transfer-token", "Transfer token to an address")
  .addOption({
    name: "to",
    description: "The recipient address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount",
    description: "The amount to transfer (in tokens, e.g., 1000 for 1000 tokens)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: { to: string; amount: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        // Validate parameters
        if (!taskArgs.to || !taskArgs.amount) {
          throw new Error("Both --to and --amount parameters are required");
        }

        const connection = await hre.network.connect();
        const { viem, ignition } = connection;
        const publicClient = await viem.getPublicClient();

        // Validate recipient address
        const toAddress = getAddress(taskArgs.to);
        console.log(`Transferring to: ${toAddress}`);

        // Parse amount (assume 18 decimals)
        const amount = parseUnits(taskArgs.amount, 18);
        console.log(`Amount: ${taskArgs.amount} tokens (${amount} wei)`);

        // Deploy or get existing token
        const { token } = await ignition.deploy(TokenModule, {
          parameters
        });

        console.log(`Token address: ${token.address}`);

        // Check sender balance
        const [sender] = await viem.getWalletClients();
        const senderBalance = await token.read.balanceOf([sender.account.address]);
        console.log(`Sender balance: ${senderBalance} wei`);

        if (senderBalance < amount) {
          throw new Error(`Insufficient balance. Have ${senderBalance}, need ${amount}`);
        }

        // Transfer tokens
        console.log("Sending transfer transaction...");
        const tx = await token.write.transfer([toAddress, amount]);
        console.log("Transaction hash:", tx);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("Transaction confirmed in block:", receipt.blockNumber);

        // Verify transfer
        const recipientBalance = await token.read.balanceOf([toAddress]);
        console.log(`\n✅ Transfer successful!`);
        console.log(`Recipient balance: ${recipientBalance} wei`);
      },
    };
  })
  .build();