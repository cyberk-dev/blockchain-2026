import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { ArgumentType } from "hardhat/types/arguments";
import { getAddress } from "viem";

function parseUint256(value: string): bigint {
  if (!value) throw new Error("Missing uint256 value");
  return value.startsWith("0x") ? BigInt(value) : BigInt(value);
}

export const addLiquidityTask = task(
  "add-liquidity",
  "Add liquidity to an LPToken pair"
)
  .addOption({
    name: "pair",
    description: "LPToken pair address",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount0",
    description: "Amount of token0 (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "amount1",
    description: "Amount of token1 (uint256, raw units)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .addOption({
    name: "to",
    description: "Recipient of LP tokens (default: deployer)",
    type: ArgumentType.STRING,
    defaultValue: "",
  })
  .setAction(async () => {
    return {
      default: async (
        taskArgs: {
          pair: string;
          amount0: string;
          amount1: string;
          to: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const { pair, amount0, amount1, to } = taskArgs;
        if (!pair) throw new Error("--pair is required");
        if (!amount0 || !amount1)
          throw new Error("Both --amount0 and --amount1 are required");

        const pairAddr = getAddress(pair) as `0x${string}`;
        const amount0Bn = parseUint256(amount0);
        const amount1Bn = parseUint256(amount1);

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        const lp = await viem.getContractAt("LPToken", pairAddr);
        const [token0Addr, token1Addr] = await Promise.all([
          lp.read.token0(),
          lp.read.token1(),
        ]);

        const token0 = await viem.getContractAt("Token", token0Addr);
        const token1 = await viem.getContractAt("Token", token1Addr);

        const toAddr = (
          to ? getAddress(to) : deployer.account.address
        ) as `0x${string}`;

        console.log("Pair:", pairAddr);
        console.log("token0:", token0Addr);
        console.log("token1:", token1Addr);
        console.log("to:", toAddr);

        console.log("Approving token0...");
        await token0.write.approve([pairAddr, amount0Bn], {
          account: deployer.account,
        });

        console.log("Approving token1...");
        await token1.write.approve([pairAddr, amount1Bn], {
          account: deployer.account,
        });

        console.log("Adding liquidity...");
        const txHash = await lp.write.addLiquidity(
          [amount0Bn, amount1Bn, toAddr],
          {
            account: deployer.account,
          }
        );

        console.log("tx:", txHash);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Done.");
        return txHash;
      },
    };
  })
  .build();
