import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
    const sender = m.getAccount(0);
    const feeReceipt = m.getParameter("feeReceipt", sender);
    const creationFee = m.getParameter("creationFee", 0);
    
    const factory = m.contract("TokenFactory", [feeReceipt, creationFee]);

    return { factory };
});

