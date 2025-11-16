import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import UpgradeFactoryModule from '../ignition/modules/UpgradeFactory.js';

export const upgradeTask = task('upgrade', 'Upgrade contracts')
  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition } = connection;
        await ignition.deploy(UpgradeFactoryModule);
      },
    };
  })
  .build();