import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress } from "viem";

function parseUint256(value: string): bigint {
  if (!value) throw new Error("Missing uint256 value");
  return value.startsWith("0x") ? BigInt(value) : BigInt(value);
}

export const swapExactInTask = task(
  "swap-exact-in",
  "Swap exact input amount on an LPToken pair"
)
  .addOption({
    name: "pair",
    description: "LPToken pair address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "tokenIn",
    description: "Input token address (must be token0 or token1)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amountIn",
    description: "Exact amount in (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "minAmountOut",
    description: "Minimum amount out (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "0",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          pair: string;
          tokenIn: string;
          amountIn: string;
          minAmountOut: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { pair, tokenIn, amountIn, minAmountOut } = taskArgs;
        if (!pair) throw new Error("--pair is required");
        if (!tokenIn) throw new Error("--tokenIn is required");
        if (!amountIn) throw new Error("--amountIn is required");

        const pairAddr = getAddress(pair) as `0x${string}`;
        const tokenInAddr = getAddress(tokenIn) as `0x${string}`;
        const amountInBn = parseUint256(amountIn);
        const minAmountOutBn = parseUint256(minAmountOut);

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        const lp = await viem.getContractAt("LPToken", pairAddr);
        const token = await viem.getContractAt("Token", tokenInAddr);

        console.log("Approving tokenIn...");
        await token.write.approve([pairAddr, amountInBn], {
          account: deployer.account,
        });

        console.log("Swapping exact in...");
        const txHash = await lp.write.swapExactIn(
          [tokenInAddr, amountInBn, minAmountOutBn],
          { account: deployer.account }
        );

        console.log("tx:", txHash);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Done.");
        return txHash;
      },
    };
  })
  .build();
