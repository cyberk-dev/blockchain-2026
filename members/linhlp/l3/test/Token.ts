import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseEther, parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("100000000", 18),
      },
    },
  });

  return { viem, ignition, publicClient, token };
}

describe("Token", async function () {
  const { networkHelpers } = await network.connect();
  let viem: Awaited<ReturnType<typeof deploy>>["viem"];
  let ignition: Awaited<ReturnType<typeof deploy>>["ignition"];
  let publicClient: Awaited<ReturnType<typeof deploy>>["publicClient"];
  let token: Awaited<ReturnType<typeof deploy>>["token"];

  beforeEach(async function () {
    const result = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );
    viem = result.viem;
    ignition = result.ignition;
    publicClient = result.publicClient;
    token = result.token;
  });

  it("Should implement progressive pricing correctly", async function () {
    const [, buyer1, buyer2] = await viem.getWalletClients();

    const initialTokenSold = await token.read.getTokenSold();
    assert.equal(initialTokenSold, 0n, "Initial tokenSold should be 0");

    // Use very small amounts to avoid huge costs
    const firstAmount = 1n; // 0.01 tokens
    const firstCost = await token.read.getCost([firstAmount]);

    await token.write.buyToken([firstAmount], {
      value: firstCost,
      account: buyer1.account,
    });

    let tokenSold = await token.read.getTokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount,
      "tokenSold should be 1 after first purchase"
    );

    const buyer1TokenBalance = await token.read.balanceOf([
      buyer1.account.address,
    ]);
    assert.equal(
      buyer1TokenBalance,
      firstAmount,
      "Buyer1 should have 1 tokens"
    );

    const secondAmount = 2n;
    const secondCost = await token.read.getCost([secondAmount]);

    const firstCostPerToken = firstCost / firstAmount;
    const secondCostPerToken = secondCost / secondAmount;
    assert.ok(
      secondCostPerToken > firstCostPerToken,
      "Cost per token should increase as more tokens are sold"
    );

    await token.write.buyToken([secondAmount], {
      value: secondCost,
      account: buyer2.account,
    });

    tokenSold = await token.read.getTokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount + secondAmount,
      "tokenSold should be 3 after second purchase"
    );

    const buyer2Balance = await token.read.balanceOf([buyer2.account.address]);
    assert.equal(buyer2Balance, secondAmount, "Buyer2 should have 0.01 tokens");
  });
});
