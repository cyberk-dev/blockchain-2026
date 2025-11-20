import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BondingCurveTokenModule", (m) => {
    const a = m.getParameter("a");
    const b = m.getParameter("b");
    const initialSupply = m.getParameter("initialSupply");

    const token = m.contract("BondingCurveToken", [
        "BondingCurve Token",
        "BCT",
        a,
        b,
       initialSupply,
    ]);

    return { token };
});