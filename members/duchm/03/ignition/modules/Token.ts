import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const token = m.contract("Token", [name, symbol], {
    id: "Token",
  });
  return { token };
});
