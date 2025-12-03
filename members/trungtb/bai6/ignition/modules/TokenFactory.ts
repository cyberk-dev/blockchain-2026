import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('TokenFactoryModule', (m) => {
  const creationFee = m.getParameter<bigint>('creationFee');
  const feeReceipt = m.getParameter<string>('feeReceipt');
  const buyTokenFeePercentage = m.getParameter<bigint>('buyTokenFeePercentage');

  const tokenFactory = m.contract('TokenFactory', [
    creationFee,
    feeReceipt,
    buyTokenFeePercentage,
  ]);

  return { tokenFactory };
});
