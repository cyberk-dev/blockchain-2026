import { ethers } from "hardhat";

export async function deploySimpleToken() {
  const [owner, account1, account2] = await ethers.getSigners();
  const SimpleToken = await ethers.getContractFactory("SimpleToken");
  
  const simpleToken = await SimpleToken.deploy("Simple Test Token", "STT");
  await simpleToken.waitForDeployment();
  
  return { simpleToken, owner, account1, account2 };
}

