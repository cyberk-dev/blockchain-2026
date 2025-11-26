import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('MockUSDTModule', (m) => {
  const mockUSDT = m.contract('MockUSDT');

  return { mockUSDT };
});
