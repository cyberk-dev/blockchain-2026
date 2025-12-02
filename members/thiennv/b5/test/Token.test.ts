import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { network } from "hardhat";

describe("Token getCost", async function () {
  const { viem, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const slope = 1n;
  const basePrice = 10n ** 18n;
  const oneToken = 10n ** 18n;
  const tenTokens = 10n * oneToken;

  async function deployToken() {
    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    const endTime = block.timestamp + 3600n;

    const token = await viem.deployContract("Token", [
      "Bonding Curve Token",
      "BCT",
      endTime,
      slope,
      basePrice,
    ]);

    return { token };
  }

  let token: Awaited<ReturnType<typeof deployToken>>["token"];

  beforeEach(async () => {
    ({ token } = await networkHelpers.loadFixture(deployToken));
  });

  it("returns the expected cost for the first token", async function () {
    const cost = await token.read.getCost([0n, oneToken]);
    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B1e18%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
    const expectedCost = 150_000_000_000_000n; // 0.00015 ETH for the very first token
    assert.equal(cost, expectedCost);
  });

  it("returns the expected cost for the next ten tokens", async function () {
    const cost = await token.read.getCost([oneToken, tenTokens]);
    const expectedCost = 7_000_000_000_000_000n; // buying 10 tokens after 1 already sold
    assert.equal(cost, expectedCost);
  });
});
