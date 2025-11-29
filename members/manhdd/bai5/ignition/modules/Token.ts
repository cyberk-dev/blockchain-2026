import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name", "BondingToken");
  const symbol = m.getParameter("symbol", "BT");
  const a = m.getParameter("a", 1n);
  const b = m.getParameter("b", 12n);
  const paymentToken = m.getParameter("paymentToken");
  const saleDuration = m.getParameter("saleDuration", 3600n);
  const buyFeePercent = m.getParameter("buyFeePercent", 5n);
  const feeRecipient = m.getParameter("feeRecipient");

  const token = m.contract("Token", [
    name,
    symbol,
    a,
    b,
    paymentToken,
    saleDuration,
    buyFeePercent,
    feeRecipient,
  ]);

  return { token };
});
