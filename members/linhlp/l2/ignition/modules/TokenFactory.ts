import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EventEmitterModule from "./EventEmitter.js";

export default buildModule("TokenFactoryModule", (m) => {
  const owner = m.getAccount(0);
  const { eventEmitter } = m.useModule(EventEmitterModule);

  const factoryImpl = m.contract("TokenFactory", [], {
    id: "TokenFactoryImpl",
  });

  const factory = m.contract(
    "ERC1967Proxy",
    [
      factoryImpl,
      m.encodeFunctionCall(factoryImpl, "initialize", [owner, eventEmitter]),
    ],
    { id: "tokenFactoryProxy" }
  );

  const factoryProxy = m.contractAt("TokenFactory", factory);
  m.call(eventEmitter, "registerPublisher", [factoryProxy]);

  return { factory: factoryProxy, eventEmitter };
});
