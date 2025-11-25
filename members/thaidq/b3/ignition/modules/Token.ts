import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
    const sender = m.getAccount(0);
    const name = m.getParameter("name");
    const symbol = m.getParameter("symbol");
    const initialSupply = m.getParameter("initialSupply");
    
    const token = m.contract("Token", [name, symbol, initialSupply]);

    return { token };
});