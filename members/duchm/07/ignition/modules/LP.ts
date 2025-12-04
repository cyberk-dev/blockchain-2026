import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LPModule = buildModule("LPModule", (m) => {
  const lpFactory = m.contract("LPFactory");
  const token0 = m.contract("PaymentToken", ["Token0", "TK0"], {
    id: 'Token0',
  })
  const token1 = m.contract("PaymentToken", ["Token1", "TK1"], {
    id: 'Token1',
  })
  return { lpFactory, token0, token1 };
});

export default LPModule;
