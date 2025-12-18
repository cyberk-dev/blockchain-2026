import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// run TokenFactoryWithBeaconModule to deploy TokenFactory with UpgradeableBeacon pattern
// npx hardhat ignition deploy ./ignition/modules/TokenFactoryWithBeacon.ts --network sepolia --parameters ignition/parameters.json
export default buildModule("TokenFactoryWithBeaconModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  const feeRecipient = m.getParameter("feeRecipient");

  const tokenImpl = m.contract("LPToken", [], {
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
    feeRecipient,
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

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const nameB = m.getParameter("nameB");
  const symbolB = m.getParameter("symbolB");

  const tokenA = m.contract("Token", [name, symbol], { id: "TokenA" });
  const tokenB = m.contract("Token", [nameB, symbolB], { id: "TokenB" });

  return {
    tokenImpl,
    tokenBeacon,
    factoryImpl,
    factoryProxy,
    factory,
    proxyAdmin,
    tokenA,
    tokenB,
  };
});
