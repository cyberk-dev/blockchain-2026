import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const TokenFactoryModule = buildModule("TokenFactoryModule", (m) => {
  const creationFee = m.getParameter("creationFee", parseEther("0.01"));
  const feeRecipient = m.getParameter("feeRecipient");

  const factory = m.contract("TokenFactory", [creationFee, feeRecipient]);
  return { factory };
});

export default TokenFactoryModule;
