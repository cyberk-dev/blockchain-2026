import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenModule from "../ignition/modules/Token.js";
import parameters from "../token-parameter.json";
import { ArgumentType } from "hardhat/types/arguments";

export const transferTokenWithParamsTask = task("transfer-token-with-params", "Transfer token with params")
    .addOption({
        name: "to",
        type: ArgumentType.STRING,
        defaultValue: "",
    })
    .addOption({
        name: "amount",
        type: ArgumentType.STRING,
        defaultValue: "",
    })
    .setAction(async () => {
        return {
            default: async (
                taskArgs: { to: string; amount: string },
                hre: HardhatRuntimeEnvironment
            ) => {
                const { to, amount } = taskArgs;

                if (!to) throw new Error("Missing --to parameter");
                if (!amount || amount === "0") throw new Error("Missing --amount parameter");

                const amountBigInt = BigInt(amount);

                const connection = await hre.network.connect();
                const { ignition, viem } = connection;
                const publicClient = await viem.getPublicClient();

                const { token } = await ignition.deploy(TokenModule, { parameters });

                const txHash = await token.write.transfer([to as `0x${string}`, amountBigInt]);
                console.log("transfer tx =", txHash);

                await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`Transfer success → sent ${amount} tokens to ${to}`);
            },
        };
    }).build();
