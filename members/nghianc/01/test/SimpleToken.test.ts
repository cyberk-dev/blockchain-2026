import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("SimpleToken", async function () {
  const { viem } = await network.connect();
  const TOKEN_NAME = "Simple Token";
  const TOKEN_SYMBOL = "STK";

  async function deployToken() {
    const contract = await viem.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
    ]);
    const [owner, addr1] = await viem.getWalletClients();
    return { contract, owner, addr1 };
  }

  it("Should mint tokens to an address", async function () {
    const { contract, addr1 } = await deployToken();
    const amount = 100n * 10n ** 18n;

    await contract.write.mint([addr1.account.address, amount]);

    const balance = await contract.read.balanceOf([addr1.account.address]);
    assert.equal(balance, amount);
  });

  it("Should have correct name and symbol", async function () {
    const { contract } = await deployToken();

    assert.equal(await contract.read.name(), TOKEN_NAME);
    assert.equal(await contract.read.symbol(), TOKEN_SYMBOL);
  });

  it("Should only allow owner to mint", async function () {
    const { contract, addr1 } = await deployToken();
    const amount = 100n * 10n ** 18n;

    try {
      await contract.write.mint([addr1.account.address, amount], {
        account: addr1.account,
      });
      assert.fail("Should have reverted");
    } catch (error) {
      assert.ok(error);
    }
  });

  it("Should increase total supply", async function () {
    const { contract, addr1 } = await deployToken();
    const amount = 1000n * 10n ** 18n;
    const initialSupply = await contract.read.totalSupply();

    await contract.write.mint([addr1.account.address, amount]);

    assert.equal(await contract.read.totalSupply(), initialSupply + amount);
  });
});
