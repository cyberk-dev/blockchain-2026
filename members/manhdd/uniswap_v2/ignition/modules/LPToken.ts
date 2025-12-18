import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LPTokenModule", (m) => {
  const tokenA = m.getParameter("tokenA", "TA");
  const tokenB = m.getParameter("tokenB", "TB");

  const lpToken = m.contract("Token", [
    tokenA,
    tokenB
  ]);

  return { lpToken };
});
