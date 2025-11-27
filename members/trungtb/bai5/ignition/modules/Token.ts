import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('TokenModule', (m) => {
  const name = m.getParameter<string>('name');
  const symbol = m.getParameter<string>('symbol');
  const feeReceipt = m.getParameter<string>('feeReceipt');
  const feePercentage = m.getParameter<bigint>('feePercentage');

  const token = m.contract('Token', [name, symbol, feeReceipt, feePercentage], {
    id: 'Token',
  });

  return { token };
});
