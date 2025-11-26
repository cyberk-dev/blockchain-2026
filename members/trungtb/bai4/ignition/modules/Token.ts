import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('TokenModule', (m) => {
  const sender = m.getAccount(0);

  const usdt = m.getParameter('usdt');

  const token = m.contract('Token', [usdt]);

  return { token };
});
