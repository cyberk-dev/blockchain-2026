import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import FactoryModule from "../ignition/modules/Factory.js";
import parameters from "../token-parameter.json";
import { ArgumentType } from "hardhat/types/arguments";
import { parseUnits } from "viem";

export const createTokenFactoryTask = task("create-token-factory", "Create token using TokenFactory")
    .addOption({
        name: "name",
        type: ArgumentType.STRING,
        defaultValue: "Shiina",
    })
    .addOption({
        name: "symbol",
        type: ArgumentType.STRING,
        defaultValue: "SHN",
    })
    .setAction(async () => {
        return {
            default: async (
                taskArgs: { name: string; symbol: string },
                hre: HardhatRuntimeEnvironment
            ) => {
                const { name, symbol } = taskArgs;

                if (!name) throw new Error("Missing --name parameter");
                if (!symbol) throw new Error("Missing --symbol parameter");

                const connection = await hre.network.connect();
                const { ignition, viem } = connection;
                const publicClient = await viem.getPublicClient();

                const { factory, mockToken } = await ignition.deploy(FactoryModule);
                const tokenFactory = await viem.getContractAt("TokenFactory", factory.address);

                const { initialSupply, endTime, a, b, scale, feeRecipient } = parameters.TokenModule;

                const initialSupplyBigInt = BigInt(initialSupply);
                const endTimeBigInt = BigInt(endTime);
                const aBigInt = BigInt(a);
                const bBigInt = BigInt(b);
                const scaleBigInt = BigInt(scale);

                const creationFee = parseUnits("0.0001", 18);

                console.log(`Creating token ${name} (${symbol}) via TokenFactory...`);
                console.log(`Factory address: ${factory.address}`);
                console.log(`Payment token (MockToken): ${mockToken.address}`);
                console.log(`Creation fee: ${creationFee} wei (0.0001 ETH)`);

                const txHash = await tokenFactory.write.createToken(
                    [
                        name,
                        symbol,
                        mockToken.address,
                        initialSupplyBigInt,
                        endTimeBigInt,
                        aBigInt,
                        bBigInt,
                        scaleBigInt,
                        feeRecipient as `0x${string}`,
                    ],
                    {
                        value: creationFee,
                    }
                );

                console.log("Create token tx =", txHash);

                const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
                console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

                const tokens = await tokenFactory.read.getAllTokens();
                const tokenAddress = tokens[tokens.length - 1] as `0x${string}`;

                console.log(`Create token success → created token ${name} (${symbol}) at ${tokenAddress}`);
            },
        };
    }).build();

