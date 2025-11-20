import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = connection;
  const publicClient = await viem.getPublicClient();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Duchm",
        symbol: "DCH",
      },
    },
  });

  return { viem, ignition, publicClient, token };
}

describe("Token", async function () {
  it("Should deploy token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    assert.ok(token.address, "Token should have an address");
    const name = await token.read.name();
    assert.equal(name, "Duchm", "Token should have correct name");
  });

  it("Should implement progressive pricing correctly", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem, publicClient } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [, buyer1, buyer2] = await viem.getWalletClients();

    const initialTokenSold = await token.read.tokenSold();
    assert.equal(initialTokenSold, 0n, "Initial tokenSold should be 0");

    const firstAmount = 10n;
    const tx1 = await token.write.buy([firstAmount], {
      value: parseEther("2"),
      account: buyer1.account,
    });
    const receipt1 = await publicClient.waitForTransactionReceipt({
      hash: tx1,
    });

    const events1 = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "TokenBought",
      fromBlock: receipt1.blockNumber,
      toBlock: receipt1.blockNumber,
    });
    assert.ok(events1.length > 0, "TokenBought event should be emitted");
    assert.ok(events1[0].args.cost !== undefined, "Cost should be in event");
    const cost1 = events1[0].args.cost!;

    let tokenSold = await token.read.tokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount,
      "tokenSold should be 10 after first purchase"
    );

    const buyer1Balance = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(
      buyer1Balance,
      firstAmount * parseUnits("1", 18),
      "Buyer1 should have 10 tokens"
    );

    const secondAmount = 5n;
    const tx2 = await token.write.buy([secondAmount], {
      value: parseEther("2"),
      account: buyer2.account,
    });
    const receipt2 = await publicClient.waitForTransactionReceipt({
      hash: tx2,
    });

    const events2 = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "TokenBought",
      fromBlock: receipt2.blockNumber,
      toBlock: receipt2.blockNumber,
    });
    assert.ok(events2.length > 0, "TokenBought event should be emitted");
    assert.ok(events2[0].args.cost !== undefined, "Cost should be in event");
    const cost2 = events2[0].args.cost!;

    const costPerToken1 = cost1 / firstAmount;
    const costPerToken2 = cost2 / secondAmount;

    assert.ok(
      costPerToken2 > costPerToken1,
      "Price per token should increase with progressive pricing"
    );

    tokenSold = await token.read.tokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount + secondAmount,
      "tokenSold should be 15 after second purchase"
    );

    const buyer2Balance = await token.read.balanceOf([buyer2.account.address]);
    assert.equal(
      buyer2Balance,
      secondAmount * parseUnits("1", 18),
      "Buyer2 should have 5 tokens"
    );
  });

  it("Should handle edge cases and errors", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(
      deploy.bind(networkHelpers)
    );

    const [, buyer] = await viem.getWalletClients();
    await assert.rejects(
      async () => {
        await token.write.buy([0n], {
          value: parseEther("2"),
        });
      },
      (error: any) => {
        const message = error.message || error.shortMessage || "";
        return message.includes("InvalidAmount");
      },
      "Should revert with InvalidAmount error"
    );

    const expectedCost = await token.read.getCost([11n]);
    await assert.rejects(
      async () => {
        await token.write.buy([11n], {
          value: expectedCost - 1n,
          account: buyer.account,
        });
      },
      (error: any) => {
        const message = error.message || error.shortMessage || "";
        return message.includes("InsufficientFunds");
      },
      "Should revert with InsufficientFunds error"
    );
  });

  it("Should have time limit for purchase", async function () {
    const connection = await network.connect();
    const { networkHelpers } = connection;
    const { token, viem } = await networkHelpers.loadFixture(
      deploy.bind(connection)
    );

    const [, buyer] = await viem.getWalletClients();

    await networkHelpers.time.increase(3601);

    await assert.rejects(
      async () => {
        await token.write.buy([10n], {
          value: parseEther("2"),
          account: buyer.account,
        });
      },
      (error: any) => {
        const message = error.message || error.shortMessage || "";
        return message.includes("PurchasePeriodEnded");
      },
      "Should revert with PurchasePeriodEnded error"
    );
  });
});
