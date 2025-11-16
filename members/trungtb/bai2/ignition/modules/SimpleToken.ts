import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('SimpleTokenModule', (m) => {
  const name = m.getParameter('name');
  const symbol = m.getParameter('symbol');
  const initialSupply = m.getParameter('initialSupply');

  const token = m.contract('SimpleToken', [name, symbol, initialSupply]);

  return { token };
});
