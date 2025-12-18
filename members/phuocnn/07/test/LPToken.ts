import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUnits } from 'viem';

import { network } from 'hardhat';
import LPTokenModule from '../ignition/modules/LPToken.js';
import { NetworkConnection } from 'hardhat/types/network';
import { parse } from 'node:path';

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { lpToken } = await ignition.deploy(LPTokenModule);

  return { viem, ignition, publicClient, lpToken };
}

async function deployWithPool(connection: NetworkConnection) {
  const { viem, ignition, publicClient, lpToken } = await deploy(connection);
  const [deployer, user] = await viem.getWalletClients();

  const token0 = await viem.deployContract('MockERC20', [
    'Token0',
    'T0',
    parseUnits('1000000', 18),
  ]);
  const token1 = await viem.deployContract('MockERC20', [
    'Token1',
    'T1',
    parseUnits('1000000', 18),
  ]);

  await token0.write.approve([lpToken.address, parseUnits('100', 18)], {
    account: deployer.account,
  });
  await token1.write.approve([lpToken.address, parseUnits('1000', 18)], {
    account: deployer.account,
  });

  await token0.write.transfer([lpToken.address, parseUnits('100', 18)], {
    account: deployer.account,
  });
  await token1.write.transfer([lpToken.address, parseUnits('1000', 18)], {
    account: deployer.account,
  });

  await lpToken.write.initialize(
    [
      token0.address,
      token1.address,
      parseUnits('100', 18),
      parseUnits('1000', 18),
    ],
    { account: deployer.account }
  );

  await token0.write.mint([user.account.address, parseUnits('100', 18)], {
    account: deployer.account,
  });
  await token1.write.mint([user.account.address, parseUnits('100', 18)], {
    account: deployer.account,
  });

  return {
    viem,
    ignition,
    publicClient,
    lpToken,
    token0,
    token1,
    user,
    deployer,
  };
}

describe('LPToken', async function () {
  it('Deploy ignition', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    console.log('lpToken', lpToken.address);
  });

  it('Swap amount in', async function () {
    const { networkHelpers } = await network.connect();
    const { token0, token1, lpToken, deployer, publicClient, viem } =
      await networkHelpers.loadFixture(deployWithPool.bind(networkHelpers));

    const reserveIn = await lpToken.read.reserve0();
    const reserveOut = await lpToken.read.reserve1();

    const amountInWithFee = 100n;
    const amountInReal = (amountInWithFee * 997n) / 1000n;
    const expectedAmountOut =
      (amountInReal * reserveOut) / (reserveIn + amountInReal);

    await token0.write.approve([lpToken.address, amountInWithFee]);

    const swapTask = lpToken.write.swap_amount_in([
      amountInWithFee,
      token0.address,
      0n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTask, token0.address, [
      { address: deployer.account.address, amount: -100n },
      { address: lpToken.address, amount: 100n },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTask, token1.address, [
      { address: deployer.account.address, amount: expectedAmountOut },
      { address: lpToken.address, amount: -expectedAmountOut },
    ]);
  });

  it('Swap amount out', async function () {
    const { networkHelpers } = await network.connect();
    const { token0, token1, lpToken, deployer, publicClient, viem } =
      await networkHelpers.loadFixture(deployWithPool.bind(networkHelpers));

    const amountOut = parseUnits('100', 18);
    const amountInMax = parseUnits('15', 18);

    await token0.write.approve([lpToken.address, amountInMax], {
      account: deployer.account,
    });

    const reserveIn = await lpToken.read.reserve0();
    const reserveOut = await lpToken.read.reserve1();

    const expectedAmountIn =
      (amountOut * reserveIn * 1000n) / ((reserveOut - amountOut) * 997n) + 1n;

    await token0.write.approve([lpToken.address, expectedAmountIn]);

    const swapTask = lpToken.write.swap_exact_out([
      amountOut,
      1000000000000000000000n,
      token1.address,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTask, token0.address, [
      { address: deployer.account.address, amount: -expectedAmountIn },
      { address: lpToken.address, amount: expectedAmountIn },
    ]);
  });
});
