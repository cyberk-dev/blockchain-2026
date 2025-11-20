import { network } from "hardhat";

async function main() {
  const connection = await network.connect({
    network: "sepolia",
    chainType: "l1",
  });
  
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [account] = await viem.getWalletClients();
  
  const address = account.account.address;
  const balance = await publicClient.getBalance({ address });
  
  console.log("Account address:", address);
  console.log("Balance:", balance.toString(), "wei");
  console.log("Balance:", (Number(balance) / 1e18).toFixed(4), "ETH");
  
  // Check if balance is sufficient (need at least 0.001 ETH for deployment)
  if (balance < BigInt(1e15)) { // 0.001 ETH
    console.log("\n[WARNING] Balance too low! You need at least 0.001 ETH to deploy.");
    console.log("Get Sepolia ETH from: https://sepoliafaucet.com/");
  } else {
    console.log("\n[OK] Balance sufficient for deployment");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

