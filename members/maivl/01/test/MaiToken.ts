import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";

describe("MaiToken Test", async function () {
  const { viem } = await network.connect();
  const [owner, nonOwner] = await viem.getWalletClients();

  let maiToken: any;

  before(async () => {
    // Deploy contract, owner = first account
    maiToken = await viem.deployContract("MaiToken", [owner.account.address]);
  });

  it("should have correct name and symbol", async () => {
    const name = await maiToken.read.name();
    const symbol = await maiToken.read.symbol();
    assert.strictEqual(name, "MaiToken");
    assert.strictEqual(symbol, "MAI");
  });

  it("initial total supply should be 0", async () => {
    const totalSupply = await maiToken.read.totalSupply();
    assert.strictEqual(totalSupply, 0n);
  });

  it("owner can mint tokens", async () => {
    const amount = 1_000n * 10n ** 18n;
      await maiToken.write.mint([owner.account.address, amount], {
      account: owner.account,
    });

    const balance = await maiToken.read.balanceOf([owner.account.address]);
    assert.strictEqual(balance, amount);

    const totalSupply = await maiToken.read.totalSupply();
    assert.strictEqual(totalSupply, amount);
  });

 it("non-owner cannot mint", async () => {
  const amount = 100n * 10n ** 18n;
  let reverted = false;

  try {
    await maiToken.write.mint([nonOwner.account.address, amount], { account: nonOwner.account });
  } catch (e: any) {
    reverted = e.message.includes("Ownable: caller is not the owner") ||
               e.message.includes("OwnableUnauthorizedAccount");
  }

  assert.ok(reverted, "non-owner should not be able to mint");
});
});
