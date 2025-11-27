import { describe, it } from 'node:test';
import { expect } from 'chai';
import { network } from 'hardhat';
import { getAddress } from 'viem';

describe('BondingCurve', async function () {
  const { viem } = await network.connect();
  const a = 10n ** 22n;
  const b = 12n * 10n ** 22n;
  const SCALE = 10n ** 22n;

  async function deployContracts() {
    const [owner, buyer] = await viem.getWalletClients();

    const usdt = await viem.deployContract('MockUSDT');
    const bondingCurve = await viem.deployContract('BondingCurve', [
      usdt.address,
    ]);

    // Transfer some USDT to the buyer and approve the bonding curve contract
    await usdt.write.transfer([buyer.account.address, 1_000_000_000_000n]);
    await usdt.write.approve([bondingCurve.address, 1_000_000_000_000n], {
      account: buyer.account,
    });

    const publicClient = await viem.getPublicClient();

    return { usdt, bondingCurve, owner, buyer, publicClient, viem };
  }

  describe('Cost Calculation', function () {
    it('should calculate the cost of the first token correctly', async function () {
      const { networkHelpers } = await network.connect();
      const { bondingCurve } = await networkHelpers.loadFixture(deployContracts);
      const expectedCost = (a * 0n + b) / SCALE; // Cost for the 1st token (supply is 0)
      const cost = await bondingCurve.read.getCost([0n, 1n]);
      expect(cost).to.equal(expectedCost);
    });

    it('should calculate the cost of the next 10 tokens correctly', async function () {
      const { networkHelpers } = await network.connect();
      const { bondingCurve } = await networkHelpers.loadFixture(deployContracts);
      const currentSupply = 100n; // Assume 100 tokens have been minted

      let expectedCost = 0n;
      for (let i = 0; i < 10; i++) {
        expectedCost += a * (currentSupply + BigInt(i)) + b;
      }
      expectedCost /= SCALE;

      const cost = await bondingCurve.read.getCost([currentSupply, 10n]);
      expect(cost).to.equal(expectedCost);
    });
  });

  describe('Token Purchase', function () {
    it('should allow a user to buy tokens', async function () {
      const { networkHelpers } = await network.connect();
      const { bondingCurve, buyer, viem } =
        await networkHelpers.loadFixture(deployContracts);
      const amountToBuy = 10n;
      const cost = await bondingCurve.read.getCost([0n, amountToBuy]);

      const hash = await bondingCurve.write.buyToken([amountToBuy], {
        account: buyer.account,
      });

      const publicClient = await viem.getPublicClient();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal('success');

      const buyerBalance = await bondingCurve.read.balanceOf([
        buyer.account.address,
      ]);
      expect(buyerBalance).to.equal(amountToBuy);
    });

    it('should emit a TokenBought event and change balances correctly', async function () {
      const { networkHelpers } = await network.connect();
      const { usdt, bondingCurve, buyer, viem } =
        await networkHelpers.loadFixture(deployContracts);
      const amountToBuy = 20n;
      const cost = await bondingCurve.read.getCost([0n, amountToBuy]);

      // Get initial balances
      const buyerBalanceBefore = await usdt.read.balanceOf([buyer.account.address]);
      const contractBalanceBefore = await usdt.read.balanceOf([bondingCurve.address]);

      const hash = await bondingCurve.write.buyToken([amountToBuy], {
        account: buyer.account,
      });

      // Check for event
      const events = await bondingCurve.getEvents.TokenBought();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.buyer as `0x${string}`)).to.equal(
        getAddress(buyer.account.address)
      );
      expect(events[0].args.amount).to.equal(amountToBuy);
      expect(events[0].args.cost).to.equal(cost);

      // Check balance changes
      const buyerBalanceAfter = await usdt.read.balanceOf([buyer.account.address]);
      const contractBalanceAfter = await usdt.read.balanceOf([bondingCurve.address]);
      
      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore - cost);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + cost);
    });
  });
});
