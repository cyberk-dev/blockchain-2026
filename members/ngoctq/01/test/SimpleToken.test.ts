import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("SimpleToken", async function () {
  const { viem } = await network.connect();

  it("Should mint tokens to an address", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const simpleToken = await viem.deployContract("SimpleToken", [
      initialSupply,
    ]);
    const [owner, addr1] = await viem.getWalletClients();

    const amount = 100n * 10n ** 18n;

    await simpleToken.write.mint([addr1.account.address, amount]);

    const balance = await simpleToken.read.balanceOf([addr1.account.address]);
    assert.equal(balance, amount);
  });

  it("Should have correct name and symbol", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const simpleToken = await viem.deployContract("SimpleToken", [
      initialSupply,
    ]);

    const name = await simpleToken.read.name();
    const symbol = await simpleToken.read.symbol();

    assert.equal(name, "VietNamVoDich");
    assert.equal(symbol, "VNVD");
  });

  it("Should only allow owner to mint", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const simpleToken = await viem.deployContract("SimpleToken", [
      initialSupply,
    ]);
    const [owner, addr1] = await viem.getWalletClients();

    const amount = 100n * 10n ** 18n;

    try {
      await simpleToken.write.mint([addr1.account.address, amount], {
        account: addr1.account,
      });
      assert.fail("Should have reverted");
    } catch (error) {
      assert.ok(error);
    }
  });
});
