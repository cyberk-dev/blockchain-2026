import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");

  // Deploy Token directly with constructor parameters
  const token = m.contract("Token", [name, symbol, initialSupply]);

  return {
    token,
  };
});
