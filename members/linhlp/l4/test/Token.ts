import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseUnits, type Account } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const blockNumber = await publicClient.getBlockNumber();
  const block = await publicClient.getBlock({ blockNumber });
  const now = Number(block.timestamp);
  const endTimeFuture = now + 3600;

  const deployment = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        a: 1n,
        b: 12n,
        scale: 10n ** 23n,
        endTime: BigInt(endTimeFuture),
      },
    },
  });

  const tokenAddress = (deployment.token as { address: `0x${string}` }).address;
  const token = await viem.getContractAt("Token", tokenAddress);

  const mockTokenAddress = (deployment.erc20Token as { address: `0x${string}` })
    .address;
  const mockToken = await viem.getContractAt("MockERC20", mockTokenAddress);

  return { viem, publicClient, token, mockToken };
}

describe("Token Pricing & Buying", async function () {
  let token: Awaited<ReturnType<typeof deploy>>["token"];
  let mockToken: Awaited<ReturnType<typeof deploy>>["mockToken"];
  let networkHelpers: Awaited<
    ReturnType<typeof network.connect>
  >["networkHelpers"];
  let buyer: Account;
  let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
  let publicClient: Awaited<ReturnType<typeof deploy>>["publicClient"];
  beforeEach(async () => {
    const connection = await network.connect();
    const deployed = await connection.networkHelpers.loadFixture(deploy);

    networkHelpers = connection.networkHelpers;
    token = deployed.token;
    mockToken = deployed.mockToken;
    publicClient = deployed.publicClient;
    buyer = (await deployed.viem.getWalletClients())[0].account;
    await mockToken.write.mint([
      buyer.address,
      1000000000000000000000000000000000000000n,
    ]);
    viem = connection.viem;
  });
  it("Price Check – First Token", async function () {
    const oneToken = 10n ** 18n;
    const cost = await token.read.getCost([0n, oneToken]);
    //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
    const expected = 5_000_000_000_000n;

    assert.equal(cost, expected, "First token price mismatch");
    const balanceBefore = await mockToken.read.balanceOf([buyer.address]);
    await mockToken.write.approve([token.address, cost], { account: buyer });
    await token.write.buyToken([oneToken], { account: buyer });
    const balanceAfter = await mockToken.read.balanceOf([buyer.address]);
    assert.equal(
      balanceAfter,
      balanceBefore - cost,
      "Balance should decrease by cost"
    );

    const balanceAfterToken = await token.read.balanceOf([buyer.address]);
    assert.equal(
      balanceAfterToken,
      oneToken,
      "Balance should increase by one token"
    );
  });

  it("Price Check – Next 10 Tokens", async function () {
    const { networkHelpers } = await network.connect();
    const deployed = await networkHelpers.loadFixture(deploy);
    const { token, publicClient: testPublicClient } = deployed;

    const oneToken = 10n ** 18n;

    const tenTokens = 10n * 10n ** 18n;
    const cost = await token.read.getCost([oneToken, tenTokens]);
    console.log("cost", cost, await token.read.totalWeiSold());
    const expected = 600_000_000_000_000n;
    assert.equal(cost, expected, "10-token batch price mismatch");
    await mockToken.write.approve(
      [token.address, 1000000000000000000000000000000000000000n],
      { account: buyer }
    );
    await token.write.buyToken([oneToken], { account: buyer });
    console.log("cost", cost, await token.read.totalWeiSold());
    const balanceBefore = await mockToken.read.balanceOf([buyer.address]);
    console.log("balanceBefore", balanceBefore);
    await token.write.buyToken([tenTokens], { account: buyer });
    const balanceAfter = await mockToken.read.balanceOf([buyer.address]);
    console.log("balanceAfter", balanceAfter);
    assert.equal(
      balanceAfter,
      balanceBefore - cost,
      "Balance should decrease by cost"
    );

    const balanceAfterToken = await token.read.balanceOf([buyer.address]);
    assert.equal(
      balanceAfterToken,
      oneToken,
      "Balance should increase by one token"
    );
  });
});
