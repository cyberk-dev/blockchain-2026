import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LPFactoryModule = buildModule("LPFactoryModule", (m) => {
  const factory = m.contract("LPFactory", []);
  return { factory };
});

export default LPFactoryModule;
