import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");

  const tokenImpl = m.contract("Token", [], { id: "TokenImpl" });

  const tokenProxy = m.contract("ERC1967Proxy", [
    tokenImpl,
    m.encodeFunctionCall(tokenImpl, "initialize", [name, symbol, initialSupply]),
  ]);

  return {
    token: m.contractAt("Token", tokenProxy),
  };
});