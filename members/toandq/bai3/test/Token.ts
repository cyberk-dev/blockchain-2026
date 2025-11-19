import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatUnits, parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition, } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Set endTime to 30 days from now (in seconds)
  const endTime = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("0", 18),
        endTime: endTime,
      },
    }
  })

  return { viem, ignition, publicClient, token, };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    console.log("token", token.address);
  });

  it("Buy token with correct price should succeed", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const [buyer] = await viem.getWalletClients();
    const amount = parseUnits("1", 18); // 1 token
    const price = await token.read.getBuyPrice([amount]);

    console.log(`Buying ${formatUnits(amount, 18)} tokens for ${formatUnits(price, 18)} ETH`);

    // Buy with exact price - should succeed
    await token.write.buyToken([amount], {
      value: price,
      account: buyer.account,
    });

    // Verify token balance
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, amount, "Token balance should equal purchased amount");
  });

  it("Buy token with insufficient price should fail", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const [buyer] = await viem.getWalletClients();
    const amount = parseUnits("1", 18); // 1 token
    const price = await token.read.getBuyPrice([amount]);
    const insufficientPrice = price - 1n; // Price minus 1 wei

    console.log(`Attempting to buy ${formatUnits(amount, 18)} tokens with ${formatUnits(insufficientPrice, 18)} ETH (insufficient)`);

    // Buy with insufficient price - should fail
    try {
      await token.write.buyToken([amount], {
        value: insufficientPrice,
        account: buyer.account,
      });
      assert.fail("buyToken should have reverted with InsufficientFunds error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InsufficientFunds") ||
        error.message.includes("revert"),
        `Expected InsufficientFunds error, got: ${error.message}`
      );
    }
  });

  it("Cannot buy token after endTime", async function () {
    const { networkHelpers } = await network.connect();

    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const [buyer] = await viem.getWalletClients();
    const contractEndTime = await token.read.endTime();

    // Time travel to after endTime
    await networkHelpers.time.increaseTo(contractEndTime + 1n);

    const amount = parseUnits("1", 18);
    const price = await token.read.getBuyPrice([amount]);

    // Try to buy token after endTime - should fail
    try {
      await token.write.buyToken([amount], {
        value: price,
        account: buyer.account,
      });
      assert.fail("buyToken should have reverted with EndTimeReached error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("EndTimeReached") ||
        error.message.includes("revert"),
        `Expected EndTimeReached error, got: ${error.message}`
      );
    }
  });
});