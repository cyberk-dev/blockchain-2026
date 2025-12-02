import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
    const sender = m.getAccount(0);
    const name = m.getParameter("name");
    const symbol = m.getParameter("symbol");
    const initialSupply = m.getParameter("initialSupply");
    const slope = m.getParameter("slope", 1e22); // slope = 1e22
    const basePrice = m.getParameter("basePrice", 1); // basePrice = 1 wei (giá token đầu tiên từ 1 wei)
    const feeReceipt = m.getParameter("feeReceipt", sender);
    const feePercentage = m.getParameter("feePercentage", 100); // 1% fee (100 basis points)
    
    const token = m.contract("Token", [name, symbol, initialSupply, slope, basePrice, feeReceipt, feePercentage]);

    return { token };
});