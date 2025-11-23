import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MockUSDTModule", (m) => {
  const decimals = m.getParameter("decimals", 6);

  const mockUSDT = m.contract("MockUSDT", [decimals]);

  return { mockUSDT };
});
