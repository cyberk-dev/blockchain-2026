import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LPTokenModule", (m) => {
  const lpToken = m.contract("LPToken");

  return { lpToken };
});