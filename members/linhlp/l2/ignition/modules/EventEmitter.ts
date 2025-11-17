import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EventEmitterModule", (m) => {
  const owner = m.getAccount(0);

  const eventEmitterImpl = m.contract("EventEmitter", [], {
    id: "EventEmitterImpl",
  });

  const eventEmitter = m.contract(
    "ERC1967Proxy",
    [
      eventEmitterImpl,
      m.encodeFunctionCall(eventEmitterImpl, "initialize", [owner]),
    ],
    { id: "eventEmitterProxy" }
  );

  return {
    eventEmitter: m.contractAt("EventEmitter", eventEmitter),
  };
});
