import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("USDT", (m) => {
  const usdt = m.contract("USDT", ["Tether USD", "USDT"]);
  return { usdt };
});
