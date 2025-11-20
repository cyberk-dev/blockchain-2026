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

describe("Token Price", async function () {

  it("Price should increase as token amount increases", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    // Test with increasing amounts
    const amounts = [
      parseUnits("1", 18),      // 1 token
      parseUnits("10", 18),      // 10 tokens
      parseUnits("100", 18),     // 100 tokens
      parseUnits("1000", 18),    // 1000 tokens
    ];

    const prices: bigint[] = [];

    for (const amount of amounts) {
      const price = await token.read.getBuyPrice([amount]);
      prices.push(price);
      console.log(`${formatUnits(amount, 18)} tokens = ${formatUnits(price, 18)} ETH`);
    }

    // Verify prices are increasing
    for (let i = 1; i < prices.length; i++) {
      assert.ok(
        prices[i] > prices[i - 1],
        `Price for ${formatUnits(amounts[i], 18)} tokens (${formatUnits(prices[i], 18)} ETH) should be greater than price for ${formatUnits(amounts[i - 1], 18)} tokens (${formatUnits(prices[i - 1], 18)} ETH)`
      );
    }
  });

  it("Price should increase as supply increases", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const amount = parseUnits("1", 18); // 1 token
    const initialPrice = await token.read.getBuyPrice([amount]);
    console.log(`Initial price for 1 token: ${formatUnits(initialPrice, 18)} ETH`);

    // Buy some tokens to increase supply
    const buyAmount = parseUnits("100", 18);
    const buyPrice = await token.read.getBuyPrice([buyAmount]);
    await token.write.buyToken([buyAmount], {
      value: buyPrice,
    });

    // Check price after supply increase
    const priceAfterSupply = await token.read.getBuyPrice([amount]);
    console.log(`Price for 1 token after buying 100 tokens: ${formatUnits(priceAfterSupply, 18)} ETH`);

    // Price should increase as supply increases
    assert.ok(
      priceAfterSupply > initialPrice,
      `Price after supply increase (${formatUnits(priceAfterSupply, 18)} ETH) should be greater than initial price (${formatUnits(initialPrice, 18)} ETH)`
    );
  });

  it("Price for same amount should be consistent", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const amount = parseUnits("50", 18);

    // Get price multiple times
    const price1 = await token.read.getBuyPrice([amount]);
    const price2 = await token.read.getBuyPrice([amount]);
    const price3 = await token.read.getBuyPrice([amount]);

    // Prices should be the same
    assert.equal(price1, price2, "Price should be consistent");
    assert.equal(price2, price3, "Price should be consistent");
  });

  it("Price for zero amount should be zero", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const amount = 0n;
    const price = await token.read.getBuyPrice([amount]);

    assert.equal(price, 0n, "Price for zero amount should be zero");
  });

  it("Price should increase with decimal token amounts (1.0 < 1.1 < 1.2)", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    // Test with decimal amounts
    const amounts = [
      parseUnits("1.0", 18),    // 1.0 token
      parseUnits("1.1", 18),    // 1.1 tokens
      parseUnits("1.2", 18),    // 1.2 tokens
    ];

    const prices: bigint[] = [];

    for (const amount of amounts) {
      const price = await token.read.getBuyPrice([amount]);
      prices.push(price);
      console.log(`${formatUnits(amount, 18)} tokens = ${formatUnits(price, 18)} ETH`);
    }

    // Verify prices are strictly increasing: 1.0 < 1.1 < 1.2
    assert.ok(
      prices[1] > prices[0],
      `Price for 1.1 tokens (${formatUnits(prices[1], 18)} ETH) should be greater than price for 1.0 token (${formatUnits(prices[0], 18)} ETH)`
    );
    assert.ok(
      prices[2] > prices[1],
      `Price for 1.2 tokens (${formatUnits(prices[2], 18)} ETH) should be greater than price for 1.1 tokens (${formatUnits(prices[1], 18)} ETH)`
    );
    assert.ok(
      prices[2] > prices[0],
      `Price for 1.2 tokens (${formatUnits(prices[2], 18)} ETH) should be greater than price for 1.0 token (${formatUnits(prices[0], 18)} ETH)`
    );
  });

  it("Price should increase with various decimal amounts", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    // Test with various decimal amounts
    const amounts = [
      parseUnits("0.1", 18),   // 0.1 token
      parseUnits("0.5", 18),   // 0.5 tokens
      parseUnits("1.0", 18),   // 1.0 token
      parseUnits("1.5", 18),   // 1.5 tokens
      parseUnits("2.0", 18),   // 2.0 tokens
      parseUnits("2.5", 18),   // 2.5 tokens
      parseUnits("5.0", 18),   // 5.0 tokens
      parseUnits("10.5", 18),  // 10.5 tokens
    ];

    const prices: bigint[] = [];

    for (const amount of amounts) {
      const price = await token.read.getBuyPrice([amount]);
      prices.push(price);
      console.log(`${formatUnits(amount, 18)} tokens = ${formatUnits(price, 18)} ETH`);
    }

    // Verify prices are strictly increasing
    for (let i = 1; i < prices.length; i++) {
      assert.ok(
        prices[i] > prices[i - 1],
        `Price for ${formatUnits(amounts[i], 18)} tokens (${formatUnits(prices[i], 18)} ETH) should be greater than price for ${formatUnits(amounts[i - 1], 18)} tokens (${formatUnits(prices[i - 1], 18)} ETH)`
      );
    }
  });

  it("Price should increase with small decimal increments", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    // Test with small decimal increments
    const amounts = [
      parseUnits("1.0", 18),   // 1.0 token
      parseUnits("1.01", 18),   // 1.01 tokens
      parseUnits("1.02", 18),   // 1.02 tokens
      parseUnits("1.05", 18),   // 1.05 tokens
      parseUnits("1.1", 18),    // 1.1 tokens
      parseUnits("1.15", 18),   // 1.15 tokens
      parseUnits("1.2", 18),    // 1.2 tokens
    ];

    const prices: bigint[] = [];

    for (const amount of amounts) {
      const price = await token.read.getBuyPrice([amount]);
      prices.push(price);
      console.log(`${formatUnits(amount, 18)} tokens = ${formatUnits(price, 18)} ETH`);
    }

    // Verify prices are strictly increasing
    for (let i = 1; i < prices.length; i++) {
      assert.ok(
        prices[i] > prices[i - 1],
        `Price for ${formatUnits(amounts[i], 18)} tokens (${formatUnits(prices[i], 18)} ETH) should be greater than price for ${formatUnits(amounts[i - 1], 18)} tokens (${formatUnits(prices[i - 1], 18)} ETH)`
      );
    }
  });
});

