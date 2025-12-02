import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TokenFactoryModule = buildModule("TokenFactoryModule", (m) => {
  const factory = m.contract("TokenFactory");

  return { factory };
});

export default TokenFactoryModule;
