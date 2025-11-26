import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "viem";

export default buildModule("TokenModule", (m) => {

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");
  const slope = m.getParameter("slope", parseUnits("0.0001", 18)); // Default: 0.0001 ETH per token
  const basePrice = m.getParameter("basePrice", parseUnits("0.001", 18)); // Default: 0.001 ETH per token
  const token = m.contract("Token", [name, symbol, initialSupply, slope, basePrice]);

  return { token };
});