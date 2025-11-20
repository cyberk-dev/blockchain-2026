import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TokenFactoryWithBeaconModule from "./TokenFactoryWithBeacon.js";

export default buildModule("UpgradeModule", (m) => {
  const { factory, tokenBeacon, proxyAdmin, factoryProxy } = m.useModule(
    TokenFactoryWithBeaconModule
  );

  const tokenImplV1 = m.contract("Token", [], {
    id: "TokenImplementationV1",
  });

  m.call(tokenBeacon, "upgradeTo", [tokenImplV1], {
    id: "UpgradeTokenBeaconV1",
  });

  const factoryImplV1 = m.contract("TokenFactory", [], {
    id: "TokenFactoryImplementationV1",
  });

  m.call(proxyAdmin, "upgradeAndCall", [factoryProxy, factoryImplV1, "0x"], {
    id: "UpgradeFactoryV1",
  });

  return {
    tokenImplV1,
    tokenBeacon,
    factoryImplV1,
    factory,
    proxyAdmin,
  };
});
