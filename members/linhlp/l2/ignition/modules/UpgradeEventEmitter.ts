import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EventEmitterModule from "./EventEmitter.js";

export default buildModule("UpgradeEventEmitterModule", (m) => {
  const { eventEmitter } = m.useModule(EventEmitterModule);

  const eventEmitterV2Impl = m.contract("EventEmitterV2", [], {
    id: "EventEmitterV2Impl",
  });

  m.call(eventEmitter, "upgradeToAndCall", [eventEmitterV2Impl, "0x"], {
    id: "UpgradeEventEmitterToV2",
  });

  return {
    eventEmitter: eventEmitter,
  };
});
