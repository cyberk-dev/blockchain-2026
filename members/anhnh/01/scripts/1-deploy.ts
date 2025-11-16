import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const name = process.env.TOKEN_NAME || "Simple Test Token";
  const symbol = process.env.TOKEN_SYMBOL || "STT";

  const [deployer] = await ethers.getSigners();
  const SimpleToken = await ethers.getContractFactory("SimpleToken");
  const simpleToken = await SimpleToken.deploy(name, symbol);
  await simpleToken.waitForDeployment();

  const address = await simpleToken.getAddress();
  const contractsDir = path.join(__dirname, "..", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const contractAddressFile = path.join(contractsDir, "SimpleToken.address.json");
  fs.writeFileSync(
    contractAddressFile,
    JSON.stringify(
      {
        address: address,
        name: name,
        symbol: symbol,
        deployedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`Deployed ${name} (${symbol}) to ${address}, owner: ${await simpleToken.owner()}, total supply: ${ethers.formatEther(await simpleToken.totalSupply())}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

