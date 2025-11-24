import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("UsdtModule", (m) => {
  const usdt = m.contract("USDT", []);

  return { usdt };
});