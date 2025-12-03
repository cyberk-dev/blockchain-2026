import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MockTokenModule from "./MockToken.js";

export default buildModule("FactoryModule", (m) => {
  const feeRecipient = "0x887ad2b33ACCAe95fEE6CA7caFD66D312Dc4ad5E";
  const factory = m.contract("TokenFactory", [feeRecipient]);
  const { mockToken } = m.useModule(MockTokenModule);

  return { factory, mockToken };
});