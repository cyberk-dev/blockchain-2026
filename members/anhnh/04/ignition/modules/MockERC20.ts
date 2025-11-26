import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

export default buildModule("MockERC20Module", (m) => {
  const name = m.getParameter("name", "Mock USDT");
  const symbol = m.getParameter("symbol", "USDT");
  const initialSupply = m.getParameter("initialSupply", parseUnits("1000000", 18));

  const mockERC20 = m.contract("MockERC20", [name, symbol, initialSupply]);

  return { mockERC20 };
});

