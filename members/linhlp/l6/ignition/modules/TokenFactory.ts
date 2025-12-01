import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

const TokenFactoryModule = buildModule("TokenFactoryModule", (m) => {
  const creationFee = m.getParameter("creationFee", parseEther("0.01"));
  const feeRecipient = m.getParameter("feeRecipient");
  const paymentToken = m.getParameter("paymentToken");
  const buyFeePercent = m.getParameter("buyFeePercent", 5n);

  const factory = m.contract("TokenFactory", [
    creationFee,
    feeRecipient,
    paymentToken,
    buyFeePercent,
  ]);
  return { factory };
});

export default TokenFactoryModule;
