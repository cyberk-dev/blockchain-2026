import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress } from "viem";

function parseUint256(value: string): bigint {
  if (!value) throw new Error("Missing uint256 value");
  return value.startsWith("0x") ? BigInt(value) : BigInt(value);
}

export const removeLiquidityTask = task(
  "remove-liquidity",
  "Remove liquidity from an LPToken pair"
)
  .addOption({
    name: "pair",
    description: "LPToken pair address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "liquidity",
    description: "LP amount to burn (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount0Min",
    description: "Minimum amount0 out (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "0",
  })
  .addOption({
    name: "amount1Min",
    description: "Minimum amount1 out (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "0",
  })
  .addOption({
    name: "to",
    description: "Recipient of token0/token1 (default: deployer)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          pair: string;
          liquidity: string;
          amount0Min: string;
          amount1Min: string;
          to: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { pair, liquidity, amount0Min, amount1Min, to } = taskArgs;
        if (!pair) throw new Error("--pair is required");
        if (!liquidity) throw new Error("--liquidity is required");

        const pairAddr = getAddress(pair) as `0x${string}`;
        const liquidityBn = parseUint256(liquidity);
        const amount0MinBn = parseUint256(amount0Min);
        const amount1MinBn = parseUint256(amount1Min);

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        const lp = await viem.getContractAt("LPToken", pairAddr);
        const toAddr = (
          to ? getAddress(to) : deployer.account.address
        ) as `0x${string}`;

        console.log("Removing liquidity...");
        const txHash = await lp.write.removeLiquidity(
          [liquidityBn, amount0MinBn, amount1MinBn, toAddr],
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
