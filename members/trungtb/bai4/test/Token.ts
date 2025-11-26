import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUnits } from 'viem';

import { network } from 'hardhat';
import TokenModule from '../ignition/modules/Token.js';
import UsdtModule from '../ignition/modules/MockUSDT.js';
import { NetworkConnection } from 'hardhat/types/network';

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const { mockUSDT } = await ignition.deploy(UsdtModule);

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        usdt: mockUSDT.address,
      },
    },
  });

  return { viem, ignition, publicClient, token, mockUSDT, deployer };
}

describe('Token', async function () {
  it('Deploy ignition', async function () {
    const { networkHelpers } = await network.connect();
    const { token, mockUSDT } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    console.log('token', token.address);
    console.log('mockUSDT', mockUSDT);
  });

  describe('Price slope 1/1e22, intercept 1/1e22', async function () {
    it('Should return correct price for first token', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );

      const [account] = await viem.getWalletClients();

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5B1%2C1e22%5Dx+%2B+Divide%5B1%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const supply = 0n;
      const price = await token.read.getCost([
        supply,
        amount,
        slope,
        intercept,
      ]);

      const expectedPrice = BigInt(5e13);

      assert.equal(price, expectedPrice, 'Price should be correct');
    });

    it('Should return correct price for next 10 tokens', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );

      const [account] = await viem.getWalletClients();

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5B1%2C1e22%5Dx+%2B+Divide%5B1%2C1e22%5D%2C%7Bx%2C1e18%2C11e18%7D%5D
      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('10', 18);
      const supply = parseUnits('1', 18);
      const price = await token.read.getCost([
        supply,
        amount,
        slope,
        intercept,
      ]);

      const expectedPrice = BigInt(6e15);

      assert.equal(price, expectedPrice, 'Price should be correct');
    });
  });

  describe('Buy token', async function () {
    it('Should buy token successfully', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, mockUSDT, deployer } =
        await networkHelpers.loadFixture(deploy.bind(networkHelpers));

      const [account] = await viem.getWalletClients();

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5B1%2C1e22%5Dx+%2B+Divide%5B1%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const supply = 0n;
      const price = await token.read.getCost([
        supply,
        amount,
        slope,
        intercept,
      ]);

      const expectedPrice = BigInt(5e13);

      assert.equal(price, expectedPrice, 'Price should be correct');

      await mockUSDT.write.mint([deployer.account.address, price]);

      const approveTx = await mockUSDT.write.approve([token.address, price]);
      assert.ok(approveTx, 'Approve transaction should succeed');

      const txn = token.write.buyToken([amount, slope, intercept]);

      assert.ok(txn, 'Buy token transaction should succeed');

      await viem.assertions.erc20BalancesHaveChanged(txn, mockUSDT.address, [
        { address: deployer.account.address, amount: -price },
        { address: token.address, amount: price },
      ]);
    });
  });
});
