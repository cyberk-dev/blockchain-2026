import { network } from "hardhat";
import { parseUnits } from "viem";

async function main() {
  const { viem } = await network.connect();
  const [wallet] = await viem.getWalletClients();

  const mockUSDT = await viem.getContractAt(
    "MockUSDT",
    "0x7787581753711eE5A34e3e485077d4216cd87B36" as `0x${string}`
  );

  console.log("Minting to:", wallet.account.address);
  const hash = await mockUSDT.write.mint([
    wallet.account.address,
    parseUnits("10000", 18)
  ]);

  const publicClient = await viem.getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash });

  console.log("✅ Minted 10,000 USDT");
  console.log("Transaction:", `https://sepolia.etherscan.io/tx/${hash}`);
}

main().catch(console.error);