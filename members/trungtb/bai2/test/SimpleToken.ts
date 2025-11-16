import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { parseUnits } from 'viem';

describe('SimpleToken', async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it('Should deploy with correct name and symbol', async function () {
    const token = await viem.deployContract('SimpleToken', [
      'Apollo Token',
      'APL',
      parseUnits('1000000000', 18),
    ]);

    const name = await token.read.name();
    const symbol = await token.read.symbol();

    assert.equal(name, 'Apollo Token');
    assert.equal(symbol, 'APL');
  });
});
