import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('LPTokenModule', (m) => {
  const tokenX = m.getParameter('tokenA', 'PEPE');
  const tokenY = m.getParameter('tokenB', 'USDT');

  const lpToken = m.contract('LPToken', [tokenX, tokenY]);

  return { lpToken };
});
