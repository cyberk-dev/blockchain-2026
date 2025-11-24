import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const sender = m.getAccount(0);

  const erc20Token = m.contract("MockERC20", ["MOCK", "MOC"]);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const endTime = m.getParameter("endTime");
  const a = m.getParameter("a");
  const b = m.getParameter("b");
  const scale = m.getParameter("scale");

  const token = m.contract("Token", [
    name,
    symbol,
    endTime,
    a,
    b,
    scale,
    erc20Token,
  ]);

  return { token, erc20Token };
});
