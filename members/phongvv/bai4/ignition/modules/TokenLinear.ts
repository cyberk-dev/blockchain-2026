import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const sender = m.getAccount(0);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const fee = m.getParameter("fee");
  const slope = m.getParameter("slope");
  const intercept = m.getParameter("intercept");

  const token = m.contract("LinearToken", [
    name,
    symbol,
    fee,
    slope,
    intercept,
  ]);

  return { token };
});
