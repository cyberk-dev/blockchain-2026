import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MockTokenModule from "./MockToken.js";

export default buildModule("FactoryModule", (m) => {
  const feeRecipient = m.getAccount(1);
  const factory = m.contract("TokenFactory", [feeRecipient]);
  const { mockToken } = m.useModule(MockTokenModule);

  return { factory, mockToken };
});