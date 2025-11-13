import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AndersonModule", (m) => {
  const anderson = m.contract("Anderson", [m.senderAddress]);

  m.call(anderson, "mint", [m.senderAddress, 1000000000000000000000000n]);

  return { anderson };
});
