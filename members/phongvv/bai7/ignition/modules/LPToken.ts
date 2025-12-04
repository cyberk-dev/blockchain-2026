import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LPTokenModule", (m) => {
  const sender = m.getAccount(0);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const token1 = m.getParameter("token1");
  const token2 = m.getParameter("token2");

  const lpToken = m.contract("Token", [name, symbol, token1, token2]);

  return { lpToken };
});
