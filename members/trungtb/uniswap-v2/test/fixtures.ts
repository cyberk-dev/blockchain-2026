import { NetworkConnection } from 'hardhat/types/network';
import { parseUnits } from 'viem';
import LpFactoryModule from '../ignition/modules/LpFactory.js';

export async function baseFixture(connection: NetworkConnection) {
  const { viem, ignition, networkHelpers } = connection;
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2] = await viem.getWalletClients();

  // Deploy Factory
  const deployed = await ignition.deploy(LpFactoryModule);
  const { lpFactory } = deployed;

  return {
    lpFactory,
    viem,
    ignition,
    publicClient,
    networkHelpers,
    users: { deployer, user1, user2 },
  };
}

export type BaseFixtureType = Awaited<ReturnType<typeof baseFixture>>;
