import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { network } from 'hardhat';
import { baseFixture } from './fixtures.js';

describe('LpFactory', async function () {
  const { networkHelpers } = await network.connect();
  const { loadFixture } = networkHelpers;

  describe('Factory Deployment', function () {
    it('Should deploy factory successfully', async function () {
      const { lpFactory } = await loadFixture(baseFixture);

      assert.ok(lpFactory.address, 'Factory should have an address');
      assert.notEqual(
        lpFactory.address,
        '0x0000000000000000000000000000000000000000'
      );
    });
  });
});
