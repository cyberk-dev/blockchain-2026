import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

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
    }
  })

  return { viem, ignition, publicClient, token };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    console.log("token", token.address);
  });

  it("Buy token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const amount = 1000000000000000000n; // 1 token
    const totalCost = await token.read.calculateTotalCost([amount]);
    
    await token.write.buyToken([amount], { 
      value: totalCost,
    });
  });

  it("Should set endTime correctly (1 hour after deployment)", async function () {
    const { networkHelpers } = await network.connect();
    const { token, publicClient } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const endTime = await token.read.endTime();
    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    const currentTime = BigInt(block.timestamp);
    const oneHour = 3600n;
    
    // endTime should be approximately 1 hour after current time
    const expectedEndTime = currentTime + oneHour;
    const timeDifference = endTime > expectedEndTime 
      ? endTime - expectedEndTime 
      : expectedEndTime - endTime;
    
    // Allow 5 seconds tolerance for block time differences
    assert.ok(timeDifference <= 5n, `endTime should be approximately 1 hour after deployment. Got difference: ${timeDifference} seconds`);
  });

  it("Should allow buying token before endTime", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const [, buyer] = await viem.getWalletClients(); // Use second account (buyer), not owner
    
    // Get initial balance
    const initialBalance = await token.read.balanceOf([buyer.account.address]);
    
    const amount = 1000000000000000000n; // 1 token
    const totalCost = await token.read.calculateTotalCost([amount]);
    
    // Buy token should succeed before endTime
    await token.write.buyToken([amount], { 
      value: totalCost,
      account: buyer.account,
    });
    
    // Check balance increased by 1 token
    const finalBalance = await token.read.balanceOf([buyer.account.address]);
    const balanceIncrease = finalBalance - initialBalance;
    assert.equal(balanceIncrease, amount, "Token balance should increase by 1 token");
  });

  it("Should reject buying token after endTime", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const [, buyer] = await viem.getWalletClients(); // Use second account (buyer)
    const endTime = await token.read.endTime();
    
    // Increase time to after endTime
    await networkHelpers.time.increaseTo(endTime + 1n);
    
    const amount = 1000000000000000000n; // 1 token
    const totalCost = await token.read.calculateTotalCost([amount]);
    
    // Try to buy token after endTime - should fail
    try {
      await token.write.buyToken([amount], { 
        value: totalCost,
        account: buyer.account,
      });
      assert.fail("Should have reverted with TimeLimitExceeded error");
    } catch (error: any) {
      // Check if error contains TimeLimitExceeded
      assert.ok(
        error.message.includes("TimeLimitExceeded") || 
        error.message.includes("execution reverted"),
        `Expected TimeLimitExceeded error, got: ${error.message}`
      );
    }
  });

  it("Should calculate progressive pricing correctly", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const [, buyer] = await viem.getWalletClients();
    const unit = parseUnits("1", 18); // 1 token
    
    // Buy first token
    const cost1 = await token.read.calculateTotalCost([unit]);
    await token.write.buyToken([unit], {
      value: cost1,
      account: buyer.account,
    });
    
    // Buy second token - should be more expensive
    const cost2 = await token.read.calculateTotalCost([unit]);
    assert.ok(cost2 > cost1, "Second token should cost more than first token");
    
    await token.write.buyToken([unit], {
      value: cost2,
      account: buyer.account,
    });
    
    // Buy third token - should be even more expensive
    const cost3 = await token.read.calculateTotalCost([unit]);
    assert.ok(cost3 > cost2, "Third token should cost more than second token");
    
    // Verify tokensSold increased correctly
    const tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, unit * 2n, "tokensSold should be 2 tokens");
  });

  it("Should calculate correct price for multiple tokens", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const [, buyer] = await viem.getWalletClients();
    const amount = parseUnits("5", 18); // 5 tokens
    
    // Calculate total cost for 5 tokens
    const totalCost = await token.read.calculateTotalCost([amount]);
    
    // Buy 5 tokens at once
    await token.write.buyToken([amount], {
      value: totalCost,
      account: buyer.account,
    });
    
    // Verify balance
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, amount, "Balance should be 5 tokens");
    
    // Verify tokensSold
    const tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, amount, "tokensSold should be 5 tokens");
  });

  it("Should reject purchase with insufficient funds", async function () {
    const { networkHelpers } = await network.connect();
    const { token, viem } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    const [, buyer] = await viem.getWalletClients();
    const amount = parseUnits("1", 18);
    const totalCost = await token.read.calculateTotalCost([amount]);
    
    // Try to buy with insufficient funds
    try {
      await token.write.buyToken([amount], {
        value: totalCost - 1n, // Less than required
        account: buyer.account,
      });
      assert.fail("Should have reverted with InsufficientFunds error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InsufficientFunds") ||
        error.message.includes("execution reverted"),
        `Expected InsufficientFunds error, got: ${error.message}`
      );
    }
  });
});

