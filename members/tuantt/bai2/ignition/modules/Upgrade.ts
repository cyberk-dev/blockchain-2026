import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TokenFactoryWithBeaconModule from "./TokenFactoryWithBeacon.js";

export default buildModule("UpgradeModuleV4", (m) => {
  const { factory, tokenBeacon, proxyAdmin, factoryProxy } = m.useModule(
    TokenFactoryWithBeaconModule
  );

  const tokenImplV4 = m.contract("Token", [], {
    id: "TokenImplementationV4",
  });

  m.call(tokenBeacon, "upgradeTo", [tokenImplV4], {
    id: "UpgradeTokenBeaconV4",
  });

  const factoryImplV4 = m.contract("TokenFactory", [], {
    id: "TokenFactoryImplementationV4",
  });

  m.call(proxyAdmin, "upgradeAndCall", [factoryProxy, factoryImplV4, "0x"], {
    id: "UpgradeFactoryV4",
  });

  return {
    tokenImplV4,
    tokenBeacon,
    factoryImplV4,
    factory,
    proxyAdmin,
  };
});
