import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import TokenFactory from './TokenFactory.js';

const UpgradeFactoryModule = buildModule('UpgradeFactoryModule', (m) => {
  const { factory } = m.useModule(TokenFactory);

  const factoryImpv2 = m.contract('TokenFactoryV2', [], { id: 'FactoryImpv3' });

  m.call(factory, 'upgradeToAndCall', [factoryImpv2, '0x'], { id: 'UpgradeFactoryImpv3' });

  return {
    factory
  };
});

export default UpgradeFactoryModule;