import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUnits, decodeEventLog, getAddress } from 'viem';

import { network } from 'hardhat';
import { NetworkConnection } from 'hardhat/types/network';
import FactoryModule from '../ignition/modules/Factory.js';

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { factory } = await ignition.deploy(FactoryModule);

  return { viem, ignition, publicClient, factory };
}

describe('Factory', async function () {
  it('Deploy factory', async function () {
    const { networkHelpers } = await network.connect();
    const { factory } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    console.log('factory', factory.address);
  });
  it('Create token', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    const txHash = await factory.write.createToken([
      'Cyberk',
      'CBK',
      parseUnits('100000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    assert.ok(tokenCreatedLog, 'TokenCreated event should be emitted');

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    assert.ok(tokenAddress, 'Token address should exist');

    console.log('Token created at:', tokenAddress);
  });

  it('Token should have endTime set correctly', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const txHash = await factory.write.createToken([
      'TestToken',
      'TST',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Get current block timestamp and endTime
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    const endTime = await token.read.endTime();

    // endTime should be approximately block.timestamp + 1 hour (3600 seconds)
    const expectedEndTime = BigInt(block.timestamp) + 3600n;
    const tolerance = 10n; // Allow 10 seconds tolerance

    assert.ok(
      endTime >= expectedEndTime - tolerance &&
        endTime <= expectedEndTime + tolerance,
      `endTime should be approximately ${expectedEndTime}, got ${endTime}`
    );
  });

  it('Should allow buyToken before endTime', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'BuyableToken',
      'BUY',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Buy token before endTime
    // With dynamic pricing: basePrice = 0.1 ether, slope = 0.0001 ether
    // Token 1: price = 0.0001 * 1 + 0.1 = 0.1001 ether
    const buyAmount = parseUnits('1', 18); // 1 token
    const buyValue = parseUnits('0.1001', 18); // 0.1001 ETH

    await token.write.buyToken([buyAmount], {
      account: buyer.account,
      value: buyValue,
    });

    // Verify tokens were minted
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, buyAmount, 'Buyer should receive tokens');
  });

  it('Should reject buyToken after endTime', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'ExpiredToken',
      'EXP',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Get endTime
    const endTime = await token.read.endTime();

    // Time travel to after endTime
    const currentBlock = await publicClient.getBlock();
    const timeToTravel = Number(endTime) - Number(currentBlock.timestamp) + 1; // +1 to ensure we're past endTime

    await networkHelpers.time.increase(timeToTravel);

    // Try to buy token after endTime - should fail
    const buyAmount = parseUnits('1', 18); // 1 token
    const buyValue = parseUnits('0.1001', 18); // 0.1001 ETH (first token price)

    try {
      await token.write.buyToken([buyAmount], {
        account: buyer.account,
        value: buyValue,
      });
      assert.fail('buyToken should have reverted with EndTimeReached error');
    } catch (error: any) {
      assert.ok(
        error.message.includes('EndTimeReached') ||
          error.message.includes('revert'),
        `Expected EndTimeReached error, got: ${error.message}`
      );
    }
  });

  it('Should calculate dynamic pricing correctly for first token', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'DynamicToken',
      'DYN',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Verify initial values
    const basePrice = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'basePrice',
    });
    const slope = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'slope',
    });
    const totalSold = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'totalSold',
    });

    assert.equal(
      basePrice,
      parseUnits('0.1', 18),
      'basePrice should be 0.1 ether'
    );
    assert.equal(
      slope,
      parseUnits('0.0001', 18),
      'slope should be 0.0001 ether'
    );
    assert.equal(totalSold, 0n, 'totalSold should start at 0');

    // Calculate expected cost for 1 token: slope * 1 * (2*0 + 1 + 1) / 2 + basePrice * 1
    // = 0.0001 * 1 * 2 / 2 + 0.1 = 0.0001 + 0.1 = 0.1001 ether
    const expectedCost = parseUnits('0.1001', 18);

    // Buy 1 token
    await token.write.buyToken([parseUnits('1', 18)], {
      account: buyer.account,
      value: expectedCost,
    });

    // Verify totalSold increased
    const newTotalSold = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'totalSold',
    });
    assert.equal(
      newTotalSold,
      parseUnits('1', 18),
      'totalSold should be 1 after buying 1 token'
    );
  });

  it('Should calculate dynamic pricing correctly for multiple tokens', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer1, buyer2] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'MultiToken',
      'MUL',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Buyer 1 buys 1 token (token #1)
    // Cost = 0.0001 * 1 * (2*0 + 1 + 1) / 2 + 0.1 * 1 = 0.1001 ether
    const cost1 = parseUnits('0.1001', 18);
    await token.write.buyToken([parseUnits('1', 18)], {
      account: buyer1.account,
      value: cost1,
    });

    let totalSold = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'totalSold',
    });
    assert.equal(totalSold, parseUnits('1', 18), 'totalSold should be 1');

    // Buyer 2 buys 2 tokens (tokens #2 and #3)
    // Cost = 0.0001 * 2 * (2*1 + 2 + 1) / 2 + 0.1 * 2
    // = 0.0001 * 2 * 5 / 2 + 0.2
    // = 0.0001 * 5 + 0.2 = 0.0005 + 0.2 = 0.2005 ether
    const cost2 = parseUnits('0.2005', 18);
    await token.write.buyToken([parseUnits('2', 18)], {
      account: buyer2.account,
      value: cost2,
    });

    totalSold = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'totalSold',
    });
    assert.equal(totalSold, parseUnits('3', 18), 'totalSold should be 3');

    // Verify balances
    const balance1 = await token.read.balanceOf([buyer1.account.address]);
    const balance2 = await token.read.balanceOf([buyer2.account.address]);

    assert.equal(balance1, parseUnits('1', 18), 'Buyer1 should have 1 token');
    assert.equal(balance2, parseUnits('2', 18), 'Buyer2 should have 2 tokens');
  });

  it('Should reject buyToken with insufficient funds', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'InsufficientToken',
      'INS',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Try to buy 1 token with insufficient funds
    // Required: 0.1001 ether, but send only 0.1 ether
    const buyAmount = parseUnits('1', 18);
    const insufficientValue = parseUnits('0.1', 18);

    try {
      await token.write.buyToken([buyAmount], {
        account: buyer.account,
        value: insufficientValue,
      });
      assert.fail('buyToken should have reverted with InsufficientFunds error');
    } catch (error: any) {
      assert.ok(
        error.message.includes('InsufficientFunds') ||
          error.message.includes('revert'),
        `Expected InsufficientFunds error, got: ${error.message}`
      );
    }
  });

  it('Should increase price progressively for each token', async function () {
    const { networkHelpers } = await network.connect();
    const { factory, publicClient, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [deployer, buyer] = await viem.getWalletClients();

    const txHash = await factory.write.createToken([
      'ProgressiveToken',
      'PRO',
      parseUnits('1000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.token as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Buy tokens one by one and verify price increases
    // Token 1: 0.0001 * 1 + 0.1 = 0.1001 ether
    await token.write.buyToken([parseUnits('1', 18)], {
      account: buyer.account,
      value: parseUnits('0.1001', 18),
    });

    // Token 2: 0.0001 * 2 + 0.1 = 0.1002 ether
    await token.write.buyToken([parseUnits('1', 18)], {
      account: buyer.account,
      value: parseUnits('0.1002', 18),
    });

    // Token 3: 0.0001 * 3 + 0.1 = 0.1003 ether
    await token.write.buyToken([parseUnits('1', 18)], {
      account: buyer.account,
      value: parseUnits('0.1003', 18),
    });

    // Verify total sold
    const totalSold = await (publicClient.readContract as any)({
      address: tokenAddress,
      abi: token.abi,
      functionName: 'totalSold',
    });
    assert.equal(totalSold, parseUnits('3', 18), 'totalSold should be 3');

    // Verify buyer balance
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, parseUnits('3', 18), 'Buyer should have 3 tokens');
  });
});
