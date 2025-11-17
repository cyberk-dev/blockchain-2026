import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {

  const factoryImpl = m.contract("TokenFactory", [], { id: "TokenFactoryImpl" });

  const factoryProxy = m.contract("ERC1967Proxy", [
    factoryImpl,
    m.encodeFunctionCall(factoryImpl, "initialize"),
  ]);

  return {
    factory: m.contractAt("TokenFactory", factoryProxy),
  };
});