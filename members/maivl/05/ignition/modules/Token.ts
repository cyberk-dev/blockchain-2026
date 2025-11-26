import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MockTokenModule from "./MockToken.js";

export default buildModule("TokenModule", (m) => {
  const sender = m.getAccount(0);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");
  const endTime = m.getParameter("endTime");
  const a = m.getParameter("a");
  const b = m.getParameter("b");
  const scale = m.getParameter("scale");

  const { mockToken } = m.useModule(MockTokenModule);
  const token = m.contract("Token", [name, symbol, mockToken, initialSupply, endTime, a, b, scale]);

  return { token, mockToken };
});