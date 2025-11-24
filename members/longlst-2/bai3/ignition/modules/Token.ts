import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const usdt = m.getParameter("usdt");
  const token = m.contract("Token", [usdt]);

  return { token };
});