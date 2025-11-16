import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => { 
    const tokenFactory = m.contract("TokenFactory");
    return { tokenFactory };
});