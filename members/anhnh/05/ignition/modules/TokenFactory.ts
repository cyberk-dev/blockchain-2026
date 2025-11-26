import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
  const feeRecipient = m.getParameter("feeRecipient");
  const creationFee = m.getParameter("creationFee", 0n);
  const buyFeeBps = m.getParameter("buyFeeBps", 0n); // basis points, 100 = 1%
  
  const factory = m.contract("TokenFactory", [feeRecipient, creationFee, buyFeeBps]);
  return { factory };
});
