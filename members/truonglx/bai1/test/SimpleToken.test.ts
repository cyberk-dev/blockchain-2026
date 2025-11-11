import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatUnits } from "viem";
import { network } from "hardhat";

describe("SuperToken", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, recipient, nonOwner] = await viem.getWalletClients();

  it("Should deploy with initial supply to owner", async function () {
    const initialSupply = 1000n * 10n ** 18n; // 1000 tokens with 18 decimals
    const token = await viem.deployContract("SuperToken", [initialSupply]);

    const ownerBalance = await token.read.balanceOf([owner.account.address]);
    assert.equal(ownerBalance, initialSupply);

    const totalSupply = await token.read.totalSupply();
    assert.equal(totalSupply, initialSupply);
    console.log("ownerBalance", formatUnits(ownerBalance, 18));
    console.log("totalSupply", formatUnits(totalSupply, 18));
  });

  it("Should allow owner to mint tokens", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const token = await viem.deployContract("SuperToken", [initialSupply]);

    const mintAmount = 500n * 10n ** 18n;
    await token.write.mint([recipient.account.address, mintAmount], {
      account: owner.account,
    });

    const recipientBalance = await token.read.balanceOf([
      recipient.account.address,
    ]);
    assert.equal(recipientBalance, mintAmount);

    const totalSupply = await token.read.totalSupply();
    assert.equal(totalSupply, initialSupply + mintAmount);
    console.log("recipientBalance", formatUnits(recipientBalance, 18));
    console.log("totalSupply", formatUnits(totalSupply, 18));
  });

  it("Should not allow non-owner to mint tokens", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const token = await viem.deployContract("SuperToken", [initialSupply]);

    const mintAmount = 500n * 10n ** 18n;

    try {
      await token.write.mint([recipient.account.address, mintAmount], {
        account: nonOwner.account,
      });
      assert.fail("Expected mint to revert for non-owner");
    } catch (error: any) {
      assert.ok(
        error.message.includes("OwnableUnauthorizedAccount") ||
          error.message.includes("revert") ||
          error.message.includes("Ownable"),
        "Expected OwnableUnauthorizedAccount error"
      );
    }
  });

  it("Should return correct owner address", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const token = await viem.deployContract("SuperToken", [initialSupply]);

    const contractOwner = (await token.read.owner()) as `0x${string}`;
    assert.equal(
      contractOwner.toLowerCase(),
      owner.account.address.toLowerCase()
    );
  });

  it("Should have correct token name and symbol", async function () {
    const initialSupply = 1000n * 10n ** 18n;
    const token = await viem.deployContract("SuperToken", [initialSupply]);

    const name = await token.read.name();
    const symbol = await token.read.symbol();

    assert.equal(name, "SuperToken");
    assert.equal(symbol, "SUP");
  });
});
