import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress, parseUnits } from "viem";
import { mulDivRoundingUp } from "../test/utils.js";

const FEE_PERCENTAGE = 500n; // 5%
const FEE_DENOMINATOR = 10_000n;
// npx hardhat buy-token --token 0x4667E7A85fb4556f6831BB0D14E24eD98DaD8A8B --amount 100000000000 --slope 2 --intercept 2 --network sepolia

export const buyTokenTask = task("buy-token", "Buy tokens from bonding curve")
  .addOption({
    name: "token",
    description: "The token contract address",
    type: ArgumentType.STRING,
    defaultValue: "0x4667E7A85fb4556f6831BB0D14E24eD98DaD8A8B",
  })
  .addOption({
    name: "amount",
    description: "The amount of tokens to buy (e.g. '1000' for 1000 tokens)",
    type: ArgumentType.STRING,
    defaultValue: "1000",
  })
  .addOption({
    name: "slope",
    description: "The slope of the bonding curve (e.g. '2')",
    type: ArgumentType.STRING,
    defaultValue: "2",
  })
  .addOption({
    name: "intercept",
    description: "The intercept of the bonding curve (e.g. '2')",
    type: ArgumentType.STRING,
    defaultValue: "2",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          token: string;
          amount: string;
          slope: string;
          intercept: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { token: tokenAddress, amount, slope, intercept } = taskArgs;

        if (!tokenAddress) {
          throw new Error("The --token address is required");
        }

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [buyer] = await viem.getWalletClients();

        console.log("Interacting with account:", buyer.account.address);

        const tokenAddr = getAddress(tokenAddress) as `0x${string}`;
        console.log(`Token address: ${tokenAddr}`);

        const tokenContract = await viem.getContractAt("Token", tokenAddr);

        // Get USDT information
        const usdtAddress = await tokenContract.read.usdt();
        const usdtContract = await viem.getContractAt("USDT", usdtAddress);

        const tokenAmount = BigInt(amount);
        const _slope = BigInt(slope);
        const _intercept = BigInt(intercept);

        console.log(`\nBuying token information:`);
        console.log(`- Amount: ${tokenAmount}`);
        console.log(`- Slope: ${_slope}`);
        console.log(`- Intercept: ${_intercept}`);

        // Calculate cost
        const currentSupply = await tokenContract.read.totalSupply();
        const cost = await tokenContract.read.getCost([
          currentSupply,
          tokenAmount,
          _slope,
          _intercept,
        ]);
        const fee = mulDivRoundingUp(cost, FEE_PERCENTAGE, FEE_DENOMINATOR);
        const totalPayment = cost + fee;

        console.log(`- Current supply: ${currentSupply}`);
        console.log(`- Cost: ${cost} wei`);
        console.log(`- Fee (5%): ${fee} wei`);
        console.log(`- Total payment: ${totalPayment} wei (USDT)`);

        // Check USDT balance
        const usdtBalance = await usdtContract.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`\nUSDT balance: ${usdtBalance} wei`);

        if (usdtBalance < totalPayment) {
          throw new Error(
            `Not enough USDT! Need ${totalPayment} wei but only have ${usdtBalance} wei`
          );
        }

        // Check allowance
        const allowance = await usdtContract.read.allowance([
          buyer.account.address,
          tokenAddr,
        ]);
        console.log(`Current allowance: ${allowance} wei`);

        if (allowance < totalPayment) {
          console.log(`\nApproving USDT...`);
          const approveTx = await usdtContract.write.approve(
            [tokenAddr, totalPayment],
            {
              account: buyer.account,
            }
          );
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
          console.log(`✅ Approved ${totalPayment} wei USDT`);
        }

        // Mua token
        console.log(`\nBuying token...`);
        const buyTx = await tokenContract.write.buyTokens(
          [tokenAmount, _slope, _intercept],
          {
            account: buyer.account,
          }
        );

        console.log("Transaction hash:", buyTx);
        console.log("Waiting for confirmation...");

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: buyTx,
        });
        console.log("✅ Token bought successfully!");

        // Check balance after buying
        const newBalance = await tokenContract.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`\nToken balance after buying: ${newBalance} wei`);

        return {
          txHash: buyTx,
          tokenAmount,
          totalPayment,
          newBalance,
        };
      },
    };
  })
  .build();
