import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

interface TransferTokenArgs {
  token: string;
  to: string;
  amount: string;
}

export default async function (
  args: TransferTokenArgs,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const { token, to, amount } = args;
  
  if (!token || !to || amount === "0") {
    console.error("Please provide valid token address, recipient address, and amount.");
    throw new Error("Invalid arguments");
  }


  const conn = await hre.network.connect();
  const { ethers } = conn as any;

  console.log("Transferring tokens...");
  console.log("Network:", conn.networkName);
  console.log("Token Address:", token);
  console.log("Recipient Address:", to);
  console.log("Amount:", amount);

  const [ signer ] = await ethers.getSigners();
  const from = await signer.getAddress();
  console.log("From Address:", from);

  const tokenContract = await ethers.getContractAt("Token", token, signer);
  const decimals = await tokenContract.decimals();
  console.log("Token Decimals:", decimals);

  const amountInUnits = ethers.utils.parseUnits(amount, decimals);
  const beforeBalance = await tokenContract.balanceOf(to);
  console.log(`Recipient balance before transfer: ${ethers.utils.formatUnits(beforeBalance, decimals)}`);

  console.log("Sending transaction...");
  const tx = await tokenContract.transfer(to, amountInUnits);
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Transaction confirmed.");

  const afterBalance = await tokenContract.balanceOf(to);
  console.log(`Recipient balance after transfer: ${ethers.utils.formatUnits(afterBalance, decimals)}`);

  console.log("Token transfer completed successfully.");
};
