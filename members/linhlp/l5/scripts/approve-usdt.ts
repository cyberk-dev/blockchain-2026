import { network } from "hardhat";
import { parseUnits } from "viem";

async function main() {
  const { viem } = await network.connect();

  const mockUSDT = await viem.getContractAt(
    "MockUSDT",
    "0x7787581753711eE5A34e3e485077d4216cd87B36" as `0x${string}`
  );

  const hash = await mockUSDT.write.approve([
    "0x26D09855b2643C7cFECCC0a7569544dfeDaA3D94" as `0x${string}`,
    parseUnits("10000", 18)
  ]);

  const publicClient = await viem.getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("✅ Approved Token to spend USDT");
  console.log("Transaction:", `https://sepolia.etherscan.io/tx/${hash}`);
}

main().catch(console.error);