import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const totalSupply = m.getParameter("totalSupply");

  const token = m.contract("Token", [name, symbol, totalSupply]);
  return { token };
});
