import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "viem";

/**
 * Ignition module for deploying TokenFactory
 *
 * TokenFactory deploys new Token contracts with:
 * - Creation fee: 0.01 ETH (configurable)
 * - Fee recipient: deployer address
 */
const TokenFactoryModule = buildModule("TokenFactoryModule", (m) => {
  // Configuration parameters
  const creationFee = m.getParameter("creationFee", parseEther("0.01"));
  const feeRecipient = m.getParameter("feeRecipient", m.getAccount(0));

  // Deploy TokenFactory
  const tokenFactory = m.contract("TokenFactory", [creationFee, feeRecipient]);

  return { tokenFactory };
});

export default TokenFactoryModule;
