import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import parameters from "../token-parameter.json";
import TokenModule from "../ignition/modules/Token.js";
import { parseEther, formatEther } from "viem";

export const buyTokenTask = task("buy-token", "Buy tokens with ETH")
  .addOption({
    name: "amount",
    description: "The amount of ETH to spend (in ETH, e.g., 0.1 for 0.1 ETH)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "price",
    description: "Token price in wei per token (optional, uses price from token-parameter.json if not provided)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: { amount: string; price: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        // Validate parameters
        if (!taskArgs.amount) {
          throw new Error("--amount parameter is required");
        }

        const connection = await hre.network.connect();
        const { viem, ignition } = connection;
        const publicClient = await viem.getPublicClient();
        const [buyer] = await viem.getWalletClients();

        // Parse ETH amount
        const ethAmount = parseEther(taskArgs.amount);
        console.log(`Buying tokens with ${taskArgs.amount} ETH (${ethAmount} wei)`);

        // Update parameters with price if provided
        const deployParams = { ...parameters };
        if (taskArgs.price) {
          deployParams.TokenModule.price = taskArgs.price;
          console.log(`Using custom price: ${taskArgs.price} wei per token`);
        }

        // Deploy or get existing token
        const { token } = await ignition.deploy(TokenModule, {
          parameters: deployParams,
        });
        
        console.log(`Token address: ${token.address}`);

        // Get token price
        const tokenPrice = await (token.read as any).price();
        console.log(`Token price: ${formatEther(tokenPrice)} ETH per token (${tokenPrice} wei)`);

        // Calculate tokens that can be bought
        // Formula: tokenAmount = ethAmount / price
        // Both ethAmount and price are already in wei
        const tokenAmount = ethAmount / tokenPrice;
        console.log(`Expected tokens: ${formatEther(tokenAmount)} tokens`);

        // Note: Token contract mints new tokens on buy, so no need to check contract balance

        // Check buyer ETH balance
        const buyerBalance = await publicClient.getBalance({
          address: buyer.account.address,
        });
        console.log(`Buyer ETH balance: ${formatEther(buyerBalance)} ETH`);

        if (buyerBalance < ethAmount) {
          throw new Error(
            `Insufficient ETH. Have ${formatEther(buyerBalance)} ETH, need ${formatEther(ethAmount)} ETH`
          );
        }

        // Buy tokens
        console.log("\n[INFO] Sending buy transaction...");
        const tx = await (token.write as any).buy({ value: ethAmount });
        console.log("Transaction hash:", tx);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("[OK] Transaction confirmed in block:", receipt.blockNumber);

        // Verify purchase
        const buyerTokenBalance = await token.read.balanceOf([buyer.account.address]);
        console.log(`\n[OK] Purchase successful!`);
        console.log(`Buyer token balance: ${formatEther(buyerTokenBalance)} tokens`);
        console.log(`ETH spent: ${formatEther(ethAmount)} ETH`);
        console.log(`Tokens received: ${formatEther(tokenAmount)} tokens`);
      },
    };
  })
  .build();

