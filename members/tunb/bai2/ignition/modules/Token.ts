import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const name = m.getParameter<string>("name");
  const symbol = m.getParameter<string>("symbol");
  const totalSupply = m.getParameter<bigint>("totalSupply");

  const token = m.contract("Token", [name, symbol, totalSupply]);
  return { token };
});
