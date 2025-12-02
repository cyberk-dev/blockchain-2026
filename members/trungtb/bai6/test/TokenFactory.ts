import { network } from 'hardhat';
import { NetworkConnection } from 'hardhat/types/network';
import TokenFactoryModule from '../ignition/modules/TokenFactory.js';
import { getAddress, parseUnits, decodeEventLog } from 'viem';
import { describe, it } from 'node:test';
import assert from 'node:assert';

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const { tokenFactory } = await ignition.deploy(TokenFactoryModule, {
    parameters: {
      TokenFactoryModule: {
        creationFee: parseUnits('1', 18),
        feeReceipt: deployer.account.address,
        buyTokenFeePercentage: 100n, // 1% fee
      },
    },
  });

  return { viem, ignition, publicClient, tokenFactory, deployer };
}

describe('TokenFactory', async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it('Should deploy token factory with correct parameters', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, deployer } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    assert.ok(tokenFactory.address, 'TokenFactory should have an address');

    const creationFee = await tokenFactory.read.creationFee();
    assert.equal(
      creationFee,
      parseUnits('1', 18),
      'Creation fee should be correct'
    );

    const feeReceipt = await tokenFactory.read.feeReceipt();
    assert.equal(
      getAddress(feeReceipt),
      getAddress(deployer.account.address),
      'Fee receipt should be correct'
    );
  });

  it('Should require fixed amount of ETH when calling createToken', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    const [creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();
    const insufficientFee = creationFee - 1n;

    // Try to create token with insufficient fee
    try {
      await tokenFactory.write.createToken(['TestToken', 'TST'], {
        account: creator.account,
        value: insufficientFee,
      });
      assert.fail(
        'createToken should have reverted with InsufficientCreationFee error'
      );
    } catch (error: any) {
      assert.ok(
        error.message.includes('InsufficientCreationFee') ||
          error.message.includes('revert'),
        `Expected InsufficientCreationFee error, got: ${error.message}`
      );
    }
  });

  it('Should transfer creation fee to fee_receipt address', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [deployer, creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();
    const feeReceipt = await tokenFactory.read.feeReceipt();

    // Get initial balance of fee receipt
    const initialBalance = await publicClient.getBalance({
      address: feeReceipt,
    });

    // Create token with exact fee
    await tokenFactory.write.createToken(['FeeToken', 'FEE'], {
      account: creator.account,
      value: creationFee,
    });

    // Check that fee was transferred
    const finalBalance = await publicClient.getBalance({
      address: feeReceipt,
    });

    assert.equal(
      finalBalance,
      initialBalance + creationFee,
      'Fee should be transferred to fee receipt address'
    );
  });

  it('Should create token successfully with correct fee', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();

    const txHash = await tokenFactory.write.createToken(['MyToken', 'MTK'], {
      account: creator.account,
      value: creationFee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(tokenFactory.address)
    );

    assert.ok(tokenCreatedLog, 'TokenCreated event should be emitted');

    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.tokenAddress as `0x${string}`;
    assert.ok(tokenAddress, 'Token address should exist');

    // Verify token contract exists and has correct name/symbol
    const token = await viem.getContractAt('Token', tokenAddress);
    const name = await token.read.name();
    const symbol = await token.read.symbol();

    assert.equal(name, 'MyToken', 'Token name should be correct');
    assert.equal(symbol, 'MTK', 'Token symbol should be correct');

    // Verify token has correct feeReceipt and feePercentage
    const tokenFeeReceipt = await (token.read as any).feeReceipt();
    const tokenFeePercentage = await (token.read as any).feePercentage();
    const factoryFeeReceipt = await tokenFactory.read.feeReceipt();
    const factoryBuyTokenFeePercentage = await (
      tokenFactory.read as any
    ).buyTokenFeePercentage();

    assert.equal(
      getAddress(tokenFeeReceipt),
      getAddress(factoryFeeReceipt),
      'Token feeReceipt should match factory feeReceipt'
    );
    assert.equal(
      tokenFeePercentage,
      factoryBuyTokenFeePercentage,
      'Token feePercentage should match factory buyTokenFeePercentage'
    );
  });

  it('Should emit TokenCreated event with correct parameters', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    const [creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();

    const txHash = await tokenFactory.write.createToken(['EventToken', 'EVT'], {
      account: creator.account,
      value: creationFee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Find TokenCreated event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(tokenFactory.address)
    );

    assert.ok(tokenCreatedLog, 'TokenCreated event should be emitted');

    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    assert.equal(
      decoded.eventName,
      'TokenCreated',
      'Event name should be TokenCreated'
    );
    assert.equal(
      (decoded?.args as any)?.name,
      'EventToken',
      'Event should contain correct token name'
    );
    assert.equal(
      (decoded?.args as any)?.symbol,
      'EVT',
      'Event should contain correct token symbol'
    );
  });

  it('Should transfer token ownership to creator', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();

    const txHash = await tokenFactory.write.createToken(['OwnedToken', 'OWN'], {
      account: creator.account,
      value: creationFee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(tokenFactory.address)
    );

    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.tokenAddress as `0x${string}`;
    const token = await viem.getContractAt('Token', tokenAddress);

    // Check that creator is the owner
    const owner = await token.read.owner();
    assert.equal(
      getAddress(owner),
      getAddress(creator.account.address),
      'Token owner should be the creator'
    );
  });

  // TODO: Need to check again
  it('Should refund excess payment when sending more than creation fee', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [creator] = await viem.getWalletClients();

    const creationFee = await tokenFactory.read.creationFee();
    const excessAmount = parseUnits('0.5', 18);
    const excessPayment = creationFee + excessAmount;

    const balanceBefore = await publicClient.getBalance({
      address: creator.account.address,
    });

    const txHash = await tokenFactory.write.createToken(
      ['ExcessToken', 'EXT'],
      {
        account: creator.account,
        value: excessPayment,
      }
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;

    const balanceAfter = await publicClient.getBalance({
      address: creator.account.address,
    });

    const expected = balanceBefore - creationFee - gasUsed;
    assert.equal(balanceAfter, expected, 'Excess payment should be refunded');
  });

  it('Should allow owner to update creation fee', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, deployer } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const newFee = parseUnits('2', 18);
    await tokenFactory.write.setCreationFee([newFee], {
      account: deployer.account,
    });

    const updatedFee = await tokenFactory.read.creationFee();
    assert.equal(updatedFee, newFee, 'Creation fee should be updated');
  });

  it('Should allow owner to update fee receipt address', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem, deployer } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, , newFeeReceipt] = await viem.getWalletClients();

    await tokenFactory.write.setFeeReceipt([newFeeReceipt.account.address], {
      account: deployer.account,
    });

    const updatedReceipt = await tokenFactory.read.feeReceipt();
    assert.equal(
      getAddress(updatedReceipt),
      getAddress(newFeeReceipt.account.address),
      'Fee receipt should be updated'
    );
  });

  it('Should transfer fee to new fee receipt after update', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, publicClient, viem, deployer } =
      await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, creator, newFeeReceipt] = await viem.getWalletClients();

    // Update fee receipt
    await tokenFactory.write.setFeeReceipt([newFeeReceipt.account.address], {
      account: deployer.account,
    });

    const creationFee = await tokenFactory.read.creationFee();
    const initialBalance = await publicClient.getBalance({
      address: newFeeReceipt.account.address,
    });

    // Create token
    await tokenFactory.write.createToken(['NewReceiptToken', 'NRT'], {
      account: creator.account,
      value: creationFee,
    });

    const finalBalance = await publicClient.getBalance({
      address: newFeeReceipt.account.address,
    });

    assert.equal(
      finalBalance,
      initialBalance + creationFee,
      'Fee should be transferred to new fee receipt address'
    );
  });

  it('Should reject non-owner from updating creation fee', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    const [, nonOwner] = await viem.getWalletClients();

    const newFee = parseUnits('2', 18);

    try {
      await tokenFactory.write.setCreationFee([newFee], {
        account: nonOwner.account,
      });
      assert.fail('setCreationFee should have reverted for non-owner');
    } catch (error: any) {
      assert.ok(
        error.message.includes('OwnableUnauthorizedAccount') ||
          error.message.includes('revert'),
        `Expected OwnableUnauthorizedAccount error, got: ${error.message}`
      );
    }
  });

  it('Should reject non-owner from updating fee receipt', async function () {
    const { networkHelpers } = await network.connect();
    const { tokenFactory, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    const [, nonOwner, newReceipt] = await viem.getWalletClients();

    try {
      await tokenFactory.write.setFeeReceipt([newReceipt.account.address], {
        account: nonOwner.account,
      });
      assert.fail('setFeeReceipt should have reverted for non-owner');
    } catch (error: any) {
      assert.ok(
        error.message.includes('OwnableUnauthorizedAccount') ||
          error.message.includes('revert'),
        `Expected OwnableUnauthorizedAccount error, got: ${error.message}`
      );
    }
  });
});
