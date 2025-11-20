import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// run TokenFactoryWithBeaconModule to deploy TokenFactory with UpgradeableBeacon pattern
// script: npx hardhat ignition run ./members/tuantt/bai3/ignition/modules/TokenFactoryWithBeacon.ts
export default buildModule("TokenFactoryWithBeaconModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);

  const tokenImpl = m.contract("Token", [], {
    id: "TokenImplementation",
  });

  const tokenBeacon = m.contract("UpgradeableBeacon", [tokenImpl], {
    id: "TokenBeacon",
  });

  const factoryImpl = m.contract("TokenFactory", [], {
    id: "TokenFactoryImplementation",
  });

  const initializeCall = m.encodeFunctionCall(factoryImpl, "initialize", [
    tokenBeacon,
  ]);

  const factoryProxy = m.contract(
    "TransparentUpgradeableProxy",
    [factoryImpl, proxyAdminOwner, initializeCall],
    {
      id: "TokenFactoryProxy",
    }
  );

  const proxyAdminAddress = m.readEventArgument(
    factoryProxy,
    "AdminChanged",
    "newAdmin"
  );
  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

  const factory = m.contractAt("TokenFactory", factoryProxy);

  return {
    tokenImpl,
    tokenBeacon,
    factoryImpl,
    factoryProxy,
    factory,
    proxyAdmin,
  };
});
