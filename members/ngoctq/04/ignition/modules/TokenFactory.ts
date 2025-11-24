import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
  const factory = m.contract("TokenFactory", []);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initial = m.getParameter("initial");

  const erc20Token = m.contract("MockERC20", [name, symbol, initial]);

  return {
    factory,
    erc20Token
  };
});
