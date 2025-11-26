import { network } from "hardhat";

const { viem } = await network.connect();
const publicClient = await viem.getPublicClient();

const factoryAddress = "0xaa37B775187819ceB3b934e5e5Fb07f47c59628A" as `0x${string}`;

console.log(`Reading version from contract: ${factoryAddress}`);

// Try TokenFactoryV2 first (in case it's upgraded), then fallback to TokenFactory
try {
  const factoryV2 = await viem.getContractAt("TokenFactoryV2", factoryAddress);
  const version = await factoryV2.read.version();
  console.log(`Factory version: ${version}`);
} catch (error) {
  // If TokenFactoryV2 fails, try TokenFactory
  try {
    const factory = await viem.getContractAt("TokenFactory", factoryAddress);
    const version = await factory.read.version();
    console.log(`Factory version: ${version}`);
  } catch (err) {
    console.error("Error reading version:", err);
    throw new Error(
      "Failed to read version from contract. Make sure the contract address is correct and the contract has a version() function."
    );
  }
}

