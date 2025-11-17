import { NetworkConnection } from "hardhat/types/network";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

export const baseFixture = async (connection: NetworkConnection) => {
  const publicClient = await connection.viem.getPublicClient();
  const { viem, networkHelpers, ignition } = connection;
  const { time } = networkHelpers;
  const [deployer, user1] = await viem.getWalletClients();
  const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

  return {
    users: { deployer, user1 },
    tokenFactory,
    viem,
    ignition,
    publicClient,
    time,
    connection,
  };
};

export type BaseFixtureType = Awaited<ReturnType<typeof baseFixture>>;
