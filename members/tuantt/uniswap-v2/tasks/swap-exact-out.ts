import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress } from "viem";

function parseUint256(value: string): bigint {
  if (!value) throw new Error("Missing uint256 value");
  return value.startsWith("0x") ? BigInt(value) : BigInt(value);
}

export const swapExactOutTask = task(
  "swap-exact-out",
  "Swap exact output amount on an LPToken pair"
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
    name: "amountOut",
    description: "Exact amount out (uint256, raw units, for the other token)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "maxAmountIn",
    description: "Maximum amount in (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          pair: string;
          tokenIn: string;
          amountOut: string;
          maxAmountIn: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { pair, tokenIn, amountOut, maxAmountIn } = taskArgs;
        if (!pair) throw new Error("--pair is required");
        if (!tokenIn) throw new Error("--tokenIn is required");
        if (!amountOut) throw new Error("--amountOut is required");
        if (!maxAmountIn) throw new Error("--maxAmountIn is required");

        const pairAddr = getAddress(pair) as `0x${string}`;
        const tokenInAddr = getAddress(tokenIn) as `0x${string}`;
        const amountOutBn = parseUint256(amountOut);
        const maxAmountInBn = parseUint256(maxAmountIn);

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        const lp = await viem.getContractAt("LPToken", pairAddr);
        const token = await viem.getContractAt("Token", tokenInAddr);

        console.log("Approving tokenIn...");
        await token.write.approve([pairAddr, maxAmountInBn], {
          account: deployer.account,
        });

        console.log("Swapping exact out...");
        const txHash = await lp.write.swapExactOut(
          [tokenInAddr, amountOutBn, maxAmountInBn],
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
