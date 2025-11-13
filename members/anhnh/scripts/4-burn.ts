import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Hardcoded defaults for easy testing
  const amount =  "100"; // 100 tokens
  
  // Read contract address from file
  const contractAddressFile = path.join(__dirname, "..", "contracts", "SimpleToken.address.json");
  if (!fs.existsSync(contractAddressFile)) {
    console.error("Error: Contract address not found. Please deploy first using: npm run deploy:local");
    process.exit(1);
  }
  const contractData = JSON.parse(fs.readFileSync(contractAddressFile, "utf8"));
  const contractAddress = contractData.address;

  const signers = await ethers.getSigners();
  // Use Account #1 (index 1) since that's where tokens were minted
  const signer = signers[1]; // Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  const simpleToken = await ethers.getContractAt("SimpleToken", contractAddress, signer);

  const balanceBefore = await simpleToken.balanceOf(signer.address);
  const totalSupplyBefore = await simpleToken.totalSupply();
  const symbol = await simpleToken.symbol();
  const amountWei = ethers.parseUnits(amount, 18);

  if (balanceBefore < amountWei) {
    console.error(`Error: Insufficient balance. Required: ${ethers.formatEther(amountWei)} ${symbol}, Available: ${ethers.formatEther(balanceBefore)} ${symbol}`);
    process.exit(1);
  }

  const tx = await simpleToken.burn(amountWei);
  await tx.wait();

  const balanceAfter = await simpleToken.balanceOf(signer.address);
  const totalSupplyAfter = await simpleToken.totalSupply();
  console.log(`Burned ${ethers.formatEther(amountWei)} ${symbol} from ${signer.address}, balance: ${ethers.formatEther(balanceAfter)}, total supply: ${ethers.formatEther(totalSupplyAfter)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });

