import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * TokenFactory Ignition Module
 * Deploys the TokenFactory contract for creating new ERC20 tokens
 */
export default buildModule("TokenFactoryModule", (m) => {
  // Deploy TokenFactory contract (no constructor parameters needed)
  const tokenFactory = m.contract("TokenFactory");

  return { tokenFactory };
});
