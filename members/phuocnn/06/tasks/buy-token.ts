import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress, decodeEventLog } from "viem";

export const buyTokenTask = task("buy-token", "Buys a specific token by sending ETH")
  .addOption({
    name: "token",
    description: "The address of the token contract to buy",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount",
    description: "The amount of tokens to buy (e.g., 100)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: { token: string; amount: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        if (!taskArgs.token || !taskArgs.amount) {
          throw new Error("Both --token and --amount parameters are required");
        }

        const connection = await hre.network.connect();
        const { viem } = connection;
        const [buyer] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();

        console.log("Buying with account:", buyer.account.address);

        const tokenAddress = getAddress(taskArgs.token) as `0x${string}`;

        const token = await viem.getContractAt("BondingCurveToken", tokenAddress);

        const tokenAmount = BigInt(taskArgs.amount);

        const cost = await token.read.calculateCost([tokenAmount]);
        const buyFeePercent = await token.read.buyFeePercent();
        const fee = (cost * buyFeePercent) / 100n;
        const totalRequired = cost + fee;

        console.log(`Buying ${taskArgs.amount} tokens at ${taskArgs.token}...`);
        console.log(`Cost: ${cost} wei`);
        console.log(`Fee (${buyFeePercent}%): ${fee} wei`);
        console.log(`Total required: ${totalRequired} wei`);

        const txHash = await token.write.buy([tokenAmount], {
          value: totalRequired,
          account: buyer.account,
        });

        console.log("Transaction hash:", txHash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Buy executed successfully!");

        const purchaseEventLogs = receipt.logs
          .map((log) => {
            try {
              return decodeEventLog({
                abi: token.abi,
                data: log.data,
                topics: log.topics,
              });
            } catch (e) {
              return null;
            }
          })
          .filter((evt) => evt && evt.eventName === "TokensPurchased");

        if (purchaseEventLogs.length > 0) {
          const event = purchaseEventLogs[0] as any;
          console.log(`Tokens purchased: ${event.args.amountOfTokens}`);
          console.log(`Total cost: ${event.args.totalCost} wei`);
          console.log(`Fee amount: ${event.args.feeAmount} wei`);
        }
      },
    };
  })
  .build();

