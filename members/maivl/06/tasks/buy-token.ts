import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import FactoryModule from "../ignition/modules/Factory.js";

export const buyTokenTask = task("buy-token", "Buy token")
    .addOption({
        name: "amount",
        type: ArgumentType.STRING,
        defaultValue: "1000000000000000000",
    })
    .setAction(async () => {
        return {
            default: async (
                taskArgs: { amount: string },
                hre: HardhatRuntimeEnvironment
            ) => {
                const { amount } = taskArgs;

                if (!amount) throw new Error("Missing --amount parameter");

                const connection = await hre.network.connect();
                const { ignition, viem } = connection;
                const publicClient = await viem.getPublicClient();
                const [walletClient] = await viem.getWalletClients();
                const buyerAddress = walletClient.account.address;

                const { factory } = await ignition.deploy(FactoryModule);
                const tokenFactory = await viem.getContractAt("TokenFactory", factory.address);
                const tokens = await tokenFactory.read.getAllTokens();

                if (tokens.length === 0) {
                    throw new Error("No tokens found in Factory. Please create a token first or provide --tokenAddress");
                }

                const tokenAddress = tokens[0] as `0x${string}`;

                const tokenContract = await viem.getContractAt("Token", tokenAddress);

                try {
                    const tokenName = await tokenContract.read.name();
                    const tokenSymbol = await tokenContract.read.symbol();
                    console.log(`Token contract verified: ${tokenName} (${tokenSymbol})`);
                } catch (error) {
                    throw new Error(`Contract at ${tokenAddress} is not a valid Token contract or doesn't exist. Error: ${error}`);
                }

                let paymentTokenAddress: `0x${string}`;
                try {
                    paymentTokenAddress = await tokenContract.read.paymentToken();
                } catch (error) {
                    throw new Error(`Failed to get payment token address. Contract may not be initialized. Error: ${error}`);
                }

                const paymentToken = await viem.getContractAt("MockToken", paymentTokenAddress);

                let totalWeiSold: bigint;
                try {
                    totalWeiSold = await tokenContract.read.totalWeiSold();
                } catch (error) {
                    throw new Error(`Failed to read totalWeiSold. Contract may not be initialized. Error: ${error}`);
                }
                const amountBigInt = BigInt(amount);

                const cost = await tokenContract.read.getCost([totalWeiSold, amountBigInt]);

                const BUY_FEE_BPS = 10n;
                const fee = (cost * BUY_FEE_BPS) / 10000n;
                const totalPayment = cost + fee;

                const balance = await paymentToken.read.balanceOf([buyerAddress]);

                if (balance < totalPayment) {
                    throw new Error(`Insufficient payment token balance. Need ${totalPayment}, have ${balance}`);
                }

                const approveTxHash = await paymentToken.write.approve([tokenAddress, totalPayment]);
                await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

                const txHash = await tokenContract.write.buyToken([amountBigInt]);
                console.log("Buy token tx =", txHash);

                await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`Buy token success → bought ${amount} tokens from ${tokenAddress}`);
            },
        };
    }).build();
