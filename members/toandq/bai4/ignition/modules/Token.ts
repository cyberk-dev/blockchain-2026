import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const usdtAddress = m.getParameter("usdtAddress");

  const token = m.contract("Token", [usdtAddress]);

  return { token };
});