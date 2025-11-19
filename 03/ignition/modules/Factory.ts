import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const sender = m.getAccount(0)

  const factory = m.contract("TokenFactory");

  return { factory };
});