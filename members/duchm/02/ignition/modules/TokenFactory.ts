import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
  const factoryImpl = m.contract("TokenFactory", [], {
    id: "TokenFactoryImplementation",
  });
  const initializeCall = m.encodeFunctionCall(factoryImpl, "initialize", []);
  const factoryProxy = m.contract(
    "ERC1967Proxy",
    [factoryImpl, initializeCall],
    {
      id: "TokenFactoryProxy",
    }
  );
  const tokenFactory = m.contractAt("TokenFactory", factoryProxy, {
    id: "TokenFactoryInstance",
  });
  return { tokenFactory };
});
