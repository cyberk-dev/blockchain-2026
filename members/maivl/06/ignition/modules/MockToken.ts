import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockTokenModule", (m) => {

  const mockToken = m.contract("MockToken");

  return { mockToken };
});