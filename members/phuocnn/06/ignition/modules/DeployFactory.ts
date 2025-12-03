import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const TokenFactoryModule = buildModule("TokenFactoryModule", (m) => {
  const creationFee = parseEther("0.001"); 
  
  const feeReceipt = m.getAccount(0); 

  const factory = m.contract("TokenFactory", [creationFee, feeReceipt]);

  return { factory };
});

export default TokenFactoryModule;