import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { decodeEventLog, parseUnits } from 'viem';

describe('TokenFactory', async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it('Should create a token', async () => {
    const tokenFactory = await viem.deployContract('TokenFactory');
    const transactionHash = await tokenFactory.write.createToken([
      'Cyberk Token',
      'CYB',
      parseUnits('1000000000', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });

    const tokenCreatedLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === tokenFactory.address.toLowerCase()
    );

    assert.ok(tokenCreatedLog, 'TokenCreated event should be emitted');

    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: tokenCreatedLog.data,
      topics: tokenCreatedLog.topics,
    });

    const tokenAddressFromEvent = decoded?.args?.tokenAddress as `0x${string}`;
    assert.ok(tokenAddressFromEvent, 'Token address should exist');
    assert.notEqual(
      tokenAddressFromEvent,
      '0x0000000000000000000000000000000000000000',
      'Token address should not be zero'
    );

    // 6. Get token contract instance
    const token = await viem.getContractAt(
      'SimpleToken',
      tokenAddressFromEvent
    );

    // 7. Verify token properties
    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const totalSupply = await token.read.totalSupply();

    assert.equal(name, 'Cyberk Token', 'Token name should match');
    assert.equal(symbol, 'CYB', 'Token symbol should match');
    assert.equal(
      totalSupply,
      parseUnits('1000000000', 18),
      'Total supply should match'
    );
  });

  it('Should create multiple tokens with different addresses', async () => {
    const tokenFactory = await viem.deployContract('TokenFactory');

    const tx1 = await tokenFactory.write.createToken([
      'Token 1',
      'T1',
      parseUnits('1000000000', 18),
    ]);
    const receipt1 = await publicClient.waitForTransactionReceipt({
      hash: tx1,
    });

    const log1 = receipt1.logs.find(
      (log) => log.address.toLowerCase() === tokenFactory.address.toLowerCase()
    );

    assert.ok(log1, 'TokenCreated event should be emitted');

    const tx2 = await tokenFactory.write.createToken([
      'Token 2',
      'T2',
      parseUnits('2000000000', 18),
    ]);
    const receipt2 = await publicClient.waitForTransactionReceipt({
      hash: tx2,
    });

    const log2 = receipt2.logs.find(
      (log) => log.address.toLowerCase() === tokenFactory.address.toLowerCase()
    );

    assert.ok(log2, 'TokenCreated event should be emitted');

    const decoded1 = decodeEventLog({
      abi: tokenFactory.abi,
      data: log1?.data,
      topics: log1?.topics,
    });
    const decoded2 = decodeEventLog({
      abi: tokenFactory.abi,
      data: log2?.data,
      topics: log2?.topics,
    });

    const address1 = decoded1?.args?.tokenAddress as `0x${string}`;
    const address2 = decoded2?.args?.tokenAddress as `0x${string}`;

    assert.notEqual(address1, address2, 'Token addresses should be different');
    assert.notEqual(
      address1,
      '0x0000000000000000000000000000000000000000',
      'Token address should not be zero'
    );
    assert.notEqual(
      address2,
      '0x0000000000000000000000000000000000000000',
      'Token address should not be zero'
    );

    const token1 = await viem.getContractAt('SimpleToken', address1);
    const token2 = await viem.getContractAt('SimpleToken', address2);

    const name1 = await token1.read.name();
    const symbol1 = await token1.read.symbol();
    const totalSupply1 = await token1.read.totalSupply();

    const name2 = await token2.read.name();
    const symbol2 = await token2.read.symbol();
    const totalSupply2 = await token2.read.totalSupply();

    assert.equal(name1, 'Token 1', 'Token name should match');
    assert.equal(symbol1, 'T1', 'Token symbol should match');
    assert.equal(
      totalSupply1,
      parseUnits('1000000000', 18),
      'Total supply should match'
    );
    assert.equal(name2, 'Token 2', 'Token name should match');
    assert.equal(symbol2, 'T2', 'Token symbol should match');
    assert.equal(
      totalSupply2,
      parseUnits('2000000000', 18),
      'Total supply should match'
    );
  });

  it('Should emit TokenCreated event with correct token address', async function () {
    const tokenFactory = await viem.deployContract('TokenFactory');

    const txHash = await tokenFactory.write.createToken([
      'Event Test Token',
      'EVT',
      parseUnits('500', 18),
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Find TokenCreated event
    const tokenCreatedLog = receipt.logs.find(
      (log) => log.address.toLowerCase() === tokenFactory.address.toLowerCase()
    );

    assert.ok(tokenCreatedLog, 'TokenCreated event should be emitted');

    // Decode event
    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    // Verify event name
    assert.equal(decoded.eventName, 'TokenCreated');

    // Verify event has tokenAddress
    assert.ok(decoded.args.tokenAddress, 'Event should contain tokenAddress');

    // Verify the address is valid (not zero)
    const tokenAddress = decoded.args.tokenAddress as `0x${string}`;
    assert.notEqual(
      tokenAddress,
      '0x0000000000000000000000000000000000000000',
      'Token address should not be zero'
    );

    // Verify the address is a valid contract
    const token = await viem.getContractAt('SimpleToken', tokenAddress);
    const code = await publicClient.getBytecode({ address: tokenAddress });
    assert.ok(code && code !== '0x', 'Token should be a deployed contract');
  });

  it('Should create tokens with different parameters', async function () {
    const tokenFactory = await viem.deployContract('TokenFactory');

    const testCases = [
      { name: 'Small Supply', symbol: 'SMALL', supply: parseUnits('1', 18) },
      {
        name: 'Large Supply',
        symbol: 'LARGE',
        supply: parseUnits('1000000000', 18),
      },
      { name: 'Zero Supply', symbol: 'ZERO', supply: 0n },
    ];

    for (const testCase of testCases) {
      const txHash = await tokenFactory.write.createToken([
        testCase.name,
        testCase.symbol,
        testCase.supply,
      ]);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      const log = receipt.logs.find(
        (log) =>
          log.address.toLowerCase() === tokenFactory.address.toLowerCase()
      );

      const decoded = decodeEventLog({
        abi: tokenFactory.abi,
        data: log!.data,
        topics: log!.topics,
      });

      const tokenAddress = decoded.args.tokenAddress as `0x${string}`;
      const token = await viem.getContractAt('SimpleToken', tokenAddress);

      assert.equal(await token.read.name(), testCase.name);
      assert.equal(await token.read.symbol(), testCase.symbol);
      assert.equal(await token.read.totalSupply(), testCase.supply);
    }
  });
});
