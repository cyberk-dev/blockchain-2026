import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryV2Module", (m) => {
  const factoryV2Impl = m.contract("TokenFactoryV2", [], {
    id: "TokenFactoryV2Implementation",
  });
  return { tokenFactoryV2: factoryV2Impl };
});
