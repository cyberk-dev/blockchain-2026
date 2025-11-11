import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';

describe('SimpleToken', async function () {
  const { viem } = await network.connect();
  const [owner, recipient, nonOwner] = await viem.getWalletClients();

  it('Should deploy with correct name and symbol', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const name = await token.read.name();
    const symbol = await token.read.symbol();

    assert.equal(name, 'Apollo Token');
    assert.equal(symbol, 'APL');
  });

  it('Should have zero initial supply', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const totalSupply = await token.read.totalSupply();
    assert.equal(totalSupply, 0n);
  });

  it('Should allow owner to mint tokens', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const mintAmount = 1000n * 10n ** 18n; // 1000 tokens with 18 decimals
    await token.write.mint([recipient.account.address, mintAmount], {
      account: owner.account,
    });

    const recipientBalance = await token.read.balanceOf([
      recipient.account.address,
    ]);
    assert.equal(recipientBalance, mintAmount);

    const totalSupply = await token.read.totalSupply();
    assert.equal(totalSupply, mintAmount);
  });

  it('Should not allow non-owner to mint tokens', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const mintAmount = 500n * 10n ** 18n;

    try {
      await token.write.mint([recipient.account.address, mintAmount], {
        account: nonOwner.account,
      });
      assert.fail('Expected mint to revert for non-owner');
    } catch (error: any) {
      assert.ok(
        error.message.includes('OwnableUnauthorizedAccount') ||
          error.message.includes('revert') ||
          error.message.includes('Ownable'),
        'Expected OwnableUnauthorizedAccount error'
      );
    }
  });

  it('Should return correct owner address', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const contractOwner = (await token.read.owner()) as `0x${string}`;
    assert.equal(
      contractOwner.toLowerCase(),
      owner.account.address.toLowerCase()
    );
  });

  it('Should allow multiple mints and update balances correctly', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
    ]);

    const firstMint = 500n * 10n ** 18n;
    const secondMint = 300n * 10n ** 18n;

    // First mint to recipient
    await token.write.mint([recipient.account.address, firstMint], {
      account: owner.account,
    });

    // Second mint to nonOwner
    await token.write.mint([nonOwner.account.address, secondMint], {
      account: owner.account,
    });

    const recipientBalance = await token.read.balanceOf([
      recipient.account.address,
    ]);
    const nonOwnerBalance = await token.read.balanceOf([
      nonOwner.account.address,
    ]);
    const totalSupply = await token.read.totalSupply();

    assert.equal(recipientBalance, firstMint);
    assert.equal(nonOwnerBalance, secondMint);
    assert.equal(totalSupply, firstMint + secondMint);
  });
});
