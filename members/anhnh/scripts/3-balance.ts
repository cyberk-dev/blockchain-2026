import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Hardcoded defaults for easy testing
  const checkAddress =  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #1
  
  // Read contract address from file
  const contractAddressFile = path.join(__dirname, "..", "contracts", "SimpleToken.address.json");
  if (!fs.existsSync(contractAddressFile)) {
    console.error("Error: Contract address not found. Please deploy first using: npm run deploy:local");
    process.exit(1);
  }
  const contractData = JSON.parse(fs.readFileSync(contractAddressFile, "utf8"));
  const contractAddress = contractData.address;

  const simpleToken = await ethers.getContractAt("SimpleToken", contractAddress);

  const balance = await simpleToken.balanceOf(checkAddress);
  const symbol = await simpleToken.symbol();
  const totalSupply = await simpleToken.totalSupply();
  const owner = await simpleToken.owner();
  const isOwner = checkAddress.toLowerCase() === owner.toLowerCase();

  console.log(`Balance of ${checkAddress}: ${ethers.formatEther(balance)} ${symbol}, total supply: ${ethers.formatEther(totalSupply)}, ${isOwner ? "owner" : "not owner"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });

