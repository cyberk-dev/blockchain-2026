import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");
  const endTime = m.getParameter("endTime");
  const slope = m.getParameter("slope");
  const startingPrice = m.getParameter("startingPrice");
  const paymentToken = m.getParameter("paymentToken");

  const token = m.contract("Token", [
    name,
    symbol,
    initialSupply,
    endTime,
    slope,
    startingPrice,
    paymentToken,
  ]);

  return { token };
});
