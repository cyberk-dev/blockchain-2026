import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {

  const toAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #1
  const amount = "1000"; // 1000 tokens
  

  const contractAddressFile = path.join(__dirname, "..", "contracts", "SimpleToken.address.json");
  if (!fs.existsSync(contractAddressFile)) {
    console.error("Error: Contract address not found. Please deploy first using: npm run deploy:local");
    process.exit(1);
  }
  const contractData = JSON.parse(fs.readFileSync(contractAddressFile, "utf8"));
  const contractAddress = contractData.address;

  const [owner] = await ethers.getSigners();
  const simpleToken = await ethers.getContractAt("SimpleToken", contractAddress);
  
  const ownerAddress = await simpleToken.owner();
  if (owner.address.toLowerCase() !== ownerAddress.toLowerCase()) {
    console.error(`Error: Account ${owner.address} is not the owner. Contract owner: ${ownerAddress}`);
    process.exit(1);
  }

  const amountWei = ethers.parseUnits(amount, 18);
  const tx = await simpleToken.mint(toAddress, amountWei);
  await tx.wait();

  const balance = await simpleToken.balanceOf(toAddress);
  const totalSupply = await simpleToken.totalSupply();
  console.log(`Minted ${ethers.formatEther(amountWei)} tokens to ${toAddress}, balance: ${ethers.formatEther(balance)}, total supply: ${ethers.formatEther(totalSupply)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });

