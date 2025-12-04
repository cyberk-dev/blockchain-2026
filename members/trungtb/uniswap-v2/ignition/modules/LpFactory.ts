import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('LpFactoryModule', (m) => {
  const lpFactory = m.contract('LpFactory');

  return { lpFactory };
});
