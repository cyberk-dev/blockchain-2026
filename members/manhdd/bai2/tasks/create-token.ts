import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import parameters from "../token-parameter.json";
import { ArgumentType } from "hardhat/types/arguments";

export const createTokenTask = task(
    "create-token",
    "Create a new token via TokenFactory"
)
    .addOption({
        name: "name",
        description: "The name of the token.",
        type: ArgumentType.STRING,
        defaultValue: "NewToken",
    })
    .addOption({
        name: "symbol",
        description: "The symbol of the token.",
        type: ArgumentType.STRING,
        defaultValue: "NTK",
    })
    .addOption({
        name: "initialSupply",
        description: "The initial supply of the token.",
        type: ArgumentType.BIGINT,
        defaultValue: 1000000n,
    })
    .setAction(async () => {
        return {
            default: async (taskArgs, hre: HardhatRuntimeEnvironment) => {
                const { name, symbol, initialSupply } = taskArgs;
                const connection = await hre.network.connect();
                const { ignition, viem } = connection;
                const publicClient = await viem.getPublicClient();

                const { factory } = await ignition.deploy(TokenFactoryModule, {});

                console.log("TokenFactory deployed at:", factory.address);

                const tx = await factory.write.createToken([
                    name as string,
                    symbol as string,
                    BigInt(initialSupply),
                ]);

                console.log("CreateToken transaction hash:", tx);

                const receipt = await publicClient.waitForTransactionReceipt({
                    hash: tx,
                });

                console.log("CreateToken transaction receipt:", receipt);

            },
        };
    })
    .build();