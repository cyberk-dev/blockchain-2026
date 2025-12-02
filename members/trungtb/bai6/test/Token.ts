import { network } from 'hardhat';
import { describe, it } from 'node:test';
import { NetworkConnection } from 'hardhat/types/network';
import TokenModule from '../ignition/modules/Token.js';
import { parseUnits, getAddress, decodeEventLog } from 'viem';
import assert from 'node:assert';

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, feeReceiptAccount] = await viem.getWalletClients();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: 'MyToken',
        symbol: 'MTK',
        feeReceipt: feeReceiptAccount.account.address,
        feePercentage: 100n, // 1% fee
      },
    },
  });

  return { viem, ignition, publicClient, token, deployer, feeReceiptAccount };
}

describe('Token', async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it('Should deploy token with correct parameters', async function () {
    const tokenParams = {
      name: 'MyToken',
      symbol: 'MTK',
    };
  });

  describe('Get cost', async function () {
    it('Should return correct cost for first token', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );

      const [account] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const supply = 0n;
      const amount = parseUnits('1', 18);
      const cost = await token.read.getCost([supply, amount, slope, intercept]);

      const expectedCost = BigInt(5e13);

      assert.equal(cost, expectedCost, 'Cost should be correct');
    });
  });

  describe('Buy Token', async function () {
    it('Should revert when amount is zero', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = 0n;

      try {
        await token.write.buyToken([amount, slope, intercept], {
          account: buyer.account,
          value: parseUnits('1', 18),
        });
        assert.fail('buyToken should have reverted with InvalidAmount error');
      } catch (error: any) {
        assert.ok(
          error.message.includes('InvalidAmount') ||
            error.message.includes('revert'),
          `Expected InvalidAmount error, got: ${error.message}`
        );
      }
    });

    it('Should revert when payment is insufficient', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, publicClient } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;
      const insufficientPayment = totalPayment - 1n;

      try {
        await token.write.buyToken([amount, slope, intercept], {
          account: buyer.account,
          value: insufficientPayment,
        });
        assert.fail(
          'buyToken should have reverted with InsufficientFunds error'
        );
      } catch (error: any) {
        assert.ok(
          error.message.includes('InsufficientFunds') ||
            error.message.includes('revert'),
          `Expected InsufficientFunds error, got: ${error.message}`
        );
      }
    });

    it('Should calculate and transfer fee correctly', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, publicClient, feeReceiptAccount } =
        await networkHelpers.loadFixture(deploy.bind(networkHelpers));
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;

      const feeReceipt = await (token.read as any).feeReceipt();

      assert.equal(
        getAddress(feeReceipt),
        getAddress(feeReceiptAccount.account.address),
        'Fee receipt should match'
      );

      const balanceBeforeTx = await publicClient.getBalance({
        address: feeReceipt,
      });

      const txHash = await token.write.buyToken([amount, slope, intercept], {
        account: buyer.account,
        value: totalPayment,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const balanceAfterTx = await publicClient.getBalance({
        address: feeReceipt,
      });

      const actualFeeReceived = balanceAfterTx - balanceBeforeTx;

      assert.equal(
        actualFeeReceived,
        fee,
        `Fee should be transferred to fee receipt address. Expected fee: ${fee}, Actual received: ${actualFeeReceived}`
      );
    });

    it('Should refund excess payment', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, publicClient } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;
      const excessAmount = parseUnits('0.1', 18);
      const excessPayment = totalPayment + excessAmount;

      // Get balance right before transaction
      const balanceBefore = await publicClient.getBalance({
        address: buyer.account.address,
      });

      const txHash = await token.write.buyToken([amount, slope, intercept], {
        account: buyer.account,
        value: excessPayment,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      const balanceAfter = await publicClient.getBalance({
        address: buyer.account.address,
      });

      const expected = balanceBefore - totalPayment - gasUsed;
      const actualChange = balanceAfter - balanceBefore;
      const expectedChange = -totalPayment - gasUsed;

      const diff =
        actualChange > expectedChange
          ? actualChange - expectedChange
          : expectedChange - actualChange;
      assert.ok(
        diff <= 1n,
        `Excess payment should be refunded. Balance before: ${balanceBefore}, Balance after: ${balanceAfter}, Expected change: ${expectedChange}, Actual change: ${actualChange}, Diff: ${diff}`
      );
    });

    it('Should mint tokens to buyer', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;

      const balanceBefore = await token.read.balanceOf([buyer.account.address]);

      await token.write.buyToken([amount, slope, intercept], {
        account: buyer.account,
        value: totalPayment,
      });

      const balanceAfter = await token.read.balanceOf([buyer.account.address]);

      assert.equal(
        balanceAfter,
        balanceBefore + amount,
        'Tokens should be minted to buyer'
      );
    });

    it('Should emit TokenBought event with correct parameters', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, publicClient } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;

      const txHash = await token.write.buyToken([amount, slope, intercept], {
        account: buyer.account,
        value: totalPayment,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      let decoded: any = null;
      const tokenAddress = (token as any).address;
      assert.ok(tokenAddress, 'Token should have an address');

      for (const log of receipt.logs) {
        if (getAddress(log.address) === getAddress(tokenAddress)) {
          try {
            const event = decodeEventLog({
              abi: token.abi,
              data: log.data,
              topics: log.topics,
            });
            if (event.eventName === 'TokenBought') {
              decoded = event;
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }

      assert.ok(decoded, 'TokenBought event should be emitted');

      assert.equal(
        decoded.eventName,
        'TokenBought',
        'Event name should be TokenBought'
      );

      const args = decoded?.args as any;
      assert.equal(
        getAddress(args.buyer),
        getAddress(buyer.account.address),
        'Event should contain correct buyer address'
      );
      assert.equal(args.amount, amount, 'Event should contain correct amount');
      assert.equal(args.cost, totalCost, 'Event should contain correct cost');
      assert.equal(args.fee, fee, 'Event should contain correct fee');
    });

    it('Should parse transaction receipt to verify event parameters', async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token, publicClient } = await networkHelpers.loadFixture(
        deploy.bind(networkHelpers)
      );
      const [buyer] = await viem.getWalletClients();

      const slope = 1n;
      const intercept = 1n;
      const amount = parseUnits('1', 18);
      const totalCost = await token.read.getCost([
        0n,
        amount,
        slope,
        intercept,
      ]);
      const feePercentage = await (token.read as any).feePercentage();
      const fee = (totalCost * feePercentage) / 10000n;
      const totalPayment = totalCost + fee;

      const txHash = await token.write.buyToken([amount, slope, intercept], {
        account: buyer.account,
        value: totalPayment,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      assert.ok(receipt.logs.length > 0, 'Receipt should have logs');

      let decoded: any = null;
      for (const log of receipt.logs) {
        if (getAddress(log.address) === getAddress(token.address)) {
          try {
            const event = decodeEventLog({
              abi: token.abi,
              data: log.data,
              topics: log.topics,
            });
            if (event.eventName === 'TokenBought') {
              decoded = event;
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }

      assert.ok(decoded, 'TokenBought event should be in transaction receipt');

      const args = decoded?.args as any;
      assert.equal(
        getAddress(args.buyer),
        getAddress(buyer.account.address),
        'Parsed buyer should match actual buyer'
      );
      assert.equal(args.amount, amount, 'Parsed amount should match');
      assert.equal(args.cost, totalCost, 'Parsed cost should match');
      assert.equal(args.fee, fee, 'Parsed fee should match');
    });
  });
});
