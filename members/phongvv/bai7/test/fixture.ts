import { NetworkConnection } from "hardhat/types/network";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import { parseUnits } from "viem";

export const baseFixture = async (connection: NetworkConnection) => {
  const publicClient = await connection.viem.getPublicClient();
  const { viem, networkHelpers, ignition } = connection;
  const { time } = networkHelpers;
  const [deployer, user1, user2] = await viem.getWalletClients();
  const { tokenFactory } = await ignition.deploy(TokenFactoryModule);
  return {
    users: { deployer, user1, user2 },
    tokenFactory,
    viem,
    ignition,
    publicClient,
    time,
    connection,
  };
};

export type BaseFixtureType = Awaited<ReturnType<typeof baseFixture>>;

export const tokenLinearFixture = async (connection: NetworkConnection) => {
  const publicClient = await connection.viem.getPublicClient();
  const { viem, networkHelpers } = connection;
  const { time } = networkHelpers;
  const [deployer, user1, user2] = await viem.getWalletClients();

  // Deploy a mock ERC20 token to use as fee token
  const feeToken = await viem.deployContract("contracts/Token.sol:Token", [
    "Fee Token",
    "FEE",
    parseUnits("10000000000", 18), // 10 billion tokens
  ]);

  // Transfer fee tokens to users for testing
  await Promise.all(
    [user1, user2].map(async (user) => {
      await feeToken.write.transfer([
        user.account.address,
        parseUnits("1000000000", 18), // 1 billion tokens each
      ]);
    })
  );

  // Deploy the TokenLinear contract
  const slope = parseUnits("1", 22);
  const intercept = parseUnits("1", 22);

  const tokenLinear = await viem.deployContract("TokenLinear", [
    "Linear Token",
    "LIN",
    feeToken.address,
    slope,
    intercept,
  ]);

  return {
    users: { deployer, user1, user2 },
    tokenLinear,
    feeToken,
    slope,
    intercept,
    viem,
    publicClient,
    time,
    connection,
  };
};

export type TokenLinearFixtureType = Awaited<
  ReturnType<typeof tokenLinearFixture>
>;

export const lpTokenFixture = async (connection: NetworkConnection) => {
  const publicClient = await connection.viem.getPublicClient();
  const { viem, networkHelpers } = connection;
  const { time } = networkHelpers;
  const [deployer, user1, user2] = await viem.getWalletClients();

  // Deploy two ERC20 tokens to use in the LP pool
  const token1 = await viem.deployContract("contracts/Token.sol:Token", [
    "Token A",
    "TKA",
    parseUnits("10000000", 18), // 10 million tokens
  ]);

  const token2 = await viem.deployContract("contracts/Token.sol:Token", [
    "Token B",
    "TKB",
    parseUnits("10000000", 18), // 10 million tokens
  ]);

  // Transfer tokens to users for testing
  await Promise.all([
    token1.write.transfer([user1.account.address, parseUnits("1000000", 18)]),
    token1.write.transfer([user2.account.address, parseUnits("1000000", 18)]),
    token2.write.transfer([user1.account.address, parseUnits("1000000", 18)]),
    token2.write.transfer([user2.account.address, parseUnits("1000000", 18)]),
  ]);

  // Deploy the LPToken contract
  const lpToken = await viem.deployContract("LPToken", [
    "LP Token",
    "LP",
    token1.address,
    token2.address,
  ]);

  return {
    users: { deployer, user1, user2 },
    lpToken,
    token1,
    token2,
    viem,
    publicClient,
    time,
    connection,
  };
};

export type LpTokenFixtureType = Awaited<ReturnType<typeof lpTokenFixture>>;
