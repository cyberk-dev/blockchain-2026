import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
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
  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress, {
    id: "ProxyAdmin",
  });

  const factory = m.contractAt("TokenFactory", factoryProxy, {
    id: "TokenFactory",
  });

  return {
    tokenImpl,
    tokenBeacon,
    factoryImpl,
    factoryProxy,
    factory,
    proxyAdmin,
  };
});