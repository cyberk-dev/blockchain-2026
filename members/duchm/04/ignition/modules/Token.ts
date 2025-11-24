import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const slope = m.getParameter("slope");
  const basePrice = m.getParameter("basePrice");

  const paymentToken = m.contract("PaymentToken", ["USD Coin", "USDC"], {
    id: "PaymentToken",
  });

  const token = m.contract(
    "Token",
    [name, symbol, paymentToken, slope, basePrice],
    {
      id: "Token",
    }
  );
  return { token, paymentToken };
});
