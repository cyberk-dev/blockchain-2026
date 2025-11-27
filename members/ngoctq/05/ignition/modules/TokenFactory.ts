import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
  const feeReceipt = m.getParameter("feeReceipt");
  const creationFee = m.getParameter("creationFee");
  const transactionFeePercentage = m.getParameter("transactionFeePercentage");

  const factory = m.contract("TokenFactory", [feeReceipt, creationFee, transactionFeePercentage]);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initial = m.getParameter("initial");

  const erc20Token = m.contract("MockERC20", [name, symbol, initial]);

  return {
    factory,
    erc20Token
  };
});
