import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AndersonModule", (m) => {
  const sender = m.getAccount(0);
  const anderson = m.contract("Anderson", [sender]);
  return { anderson };
});
