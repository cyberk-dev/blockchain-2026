import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("SimpleToken", async function () {
  const { viem } = await network.connect();

  it("Should mint tokens to an address", async function () {
    const simpleToken = await viem.deployContract("SimpleToken", [
      "HelloWorld",
      "HW",
    ]);
    const [owner, addr1] = await viem.getWalletClients();

    const amount = 100n * 10n ** 18n;

    await simpleToken.write.mint([addr1.account.address, amount]);

    const balance = await simpleToken.read.balanceOf([addr1.account.address]);
    assert.equal(balance, amount);
  });

  it("Should have correct name and symbol", async function () {
    const simpleToken = await viem.deployContract("SimpleToken", [
      "HelloWorld",
      "HW",
    ]);

    const name = await simpleToken.read.name();
    const symbol = await simpleToken.read.symbol();

    assert.equal(name, "HelloWorld");
    assert.equal(symbol, "HW");
  });

  it("Should only allow owner to mint", async function () {
    const simpleToken = await viem.deployContract("SimpleToken", [
      "HelloWorld",
      "HW",
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
