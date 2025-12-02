import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MockUSDTModule = buildModule("MockUSDTModule", (m) => {
  const usdt = m.contract("MockUSDT");

  return { usdt };
});

export default MockUSDTModule;
