import assert from "node:assert/strict";
import { describe, it } from "node:test";
import TokenModule from "../ignition/modules/Token.js";

import { network } from "hardhat";
import { parseEther, parseUnits } from "viem";

describe("Token with Progressive Pricing", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, buyer1, buyer2] = await viem.getWalletClients();

  // Test parameters
  const ONE_HOUR = 3600n;
  const SLOPE = parseEther("0.0001"); // 0.0001 ETH increase per token
  const STARTING_PRICE = parseEther("0.001"); // 0.001 ETH starting price

  /**
   * Helper function to get current block timestamp
   */
  async function getCurrentTimestamp(): Promise<bigint> {
    const block = await publicClient.getBlock();
    return block.timestamp;
  }

  /**
   * Helper to deploy token with default test parameters
   */
  async function deployToken(endTimeOffset: bigint = ONE_HOUR) {
    const currentTime = await getCurrentTimestamp();
    const endTime = currentTime + endTimeOffset;

    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "TestToken",
          symbol: "TEST",
          initialSupply: parseUnits("1000", 18),
          endTime: endTime,
          slope: SLOPE,
          startingPrice: STARTING_PRICE,
        },
      },
    });

    return { token, endTime };
  }

  // ============================================
  // Deployment Tests
  // ============================================

  it("Should deploy with correct parameters", async function () {
    const { token, endTime } = await deployToken();

    const actualEndTime = await token.read.endTime();
    const actualSlope = await token.read.slope();
    const actualStartingPrice = await token.read.startingPrice();
    const actualTokensSold = await token.read.tokensSold();

    assert.equal(actualEndTime, endTime, "End time should match");
    assert.equal(actualSlope, SLOPE, "Slope should match");
    assert.equal(actualStartingPrice, STARTING_PRICE, "Starting price should match");
    assert.equal(actualTokensSold, 0n, "Tokens sold should be 0");

    console.log(`Token deployed with endTime: ${endTime}, slope: ${SLOPE}, startingPrice: ${STARTING_PRICE}`);
  });

  it("Should mint initial supply to deployer", async function () {
    const { token } = await deployToken();
    const initialSupply = parseUnits("1000", 18);

    const balance = await token.read.balanceOf([deployer.account.address]);
    assert.equal(balance, initialSupply, "Deployer should have initial supply");

    console.log(`Deployer balance: ${balance}`);
  });

  // ============================================
  // Time Limit Tests
  // ============================================

  it("Should allow buying within time limit", async function () {
    const { token } = await deployToken();

    const isSaleActive = await token.read.isSaleActive();
    assert.equal(isSaleActive, true, "Sale should be active");

    const amount = 1n;
    const cost = await token.read.calculatePurchaseCost([amount]);

    // Create buyer token instance
    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    await buyerToken.write.buyToken([amount], { value: cost });

    const buyerBalance = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(buyerBalance, amount, "Buyer should receive tokens");

    console.log(`Successfully bought ${amount} token for ${cost} wei`);
  });

  it("Should report correct time remaining", async function () {
    const { token } = await deployToken();

    const timeRemaining = await token.read.getTimeRemaining();
    assert.ok(timeRemaining > 0n, "Time remaining should be positive");
    assert.ok(timeRemaining <= ONE_HOUR, "Time remaining should be <= 1 hour");

    console.log(`Time remaining: ${timeRemaining} seconds`);
  });

  // ============================================
  // Progressive Pricing Tests
  // ============================================

  it("Should calculate correct price for first token", async function () {
    const { token } = await deployToken();

    // First token price: y = a * 1 + b = 0.0001 + 0.001 = 0.0011 ETH
    const currentPrice = await token.read.getCurrentPrice();
    const expectedPrice = SLOPE * 1n + STARTING_PRICE;

    assert.equal(currentPrice, expectedPrice, "First token price should match formula");
    console.log(`First token price: ${currentPrice} wei (${Number(currentPrice) / 1e18} ETH)`);
  });

  it("Should calculate progressive pricing correctly", async function () {
    const { token } = await deployToken();

    // Calculate cost for 1 token when 0 sold
    // Price = a*1 + b = 0.0001 + 0.001 = 0.0011 ETH
    const cost1 = await token.read.calculatePurchaseCost([1n]);
    const expectedCost1 = SLOPE * 1n + STARTING_PRICE;
    assert.equal(cost1, expectedCost1, "Cost for 1 token should be correct");

    // Calculate cost for 5 tokens when 0 sold
    // Sum(i=1 to 5) of (a*i + b) = a*(1+2+3+4+5) + b*5 = a*15 + b*5
    // = 0.0001*15 + 0.001*5 = 0.0015 + 0.005 = 0.0065 ETH
    const cost5 = await token.read.calculatePurchaseCost([5n]);
    const expectedCost5 = SLOPE * 15n + STARTING_PRICE * 5n;
    assert.equal(cost5, expectedCost5, "Cost for 5 tokens should be correct");

    console.log(`Cost for 1 token: ${cost1} wei`);
    console.log(`Cost for 5 tokens: ${cost5} wei`);
  });

  it("Should increase price as tokens are sold", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    // Get price before buying
    const priceBefore = await token.read.getCurrentPrice();

    // Buy 10 tokens
    const amount = 10n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    await buyerToken.write.buyToken([amount], { value: cost });

    // Get price after buying
    const priceAfter = await token.read.getCurrentPrice();

    assert.ok(priceAfter > priceBefore, "Price should increase after buying");

    // Price should increase by slope * 10
    const expectedIncrease = SLOPE * amount;
    const actualIncrease = priceAfter - priceBefore;
    assert.equal(actualIncrease, expectedIncrease, "Price increase should match slope * amount");

    console.log(`Price before: ${priceBefore}, after: ${priceAfter}, increase: ${actualIncrease}`);
  });

  it("Should calculate cost correctly after some tokens sold", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    // Buy 5 tokens first
    const firstAmount = 5n;
    const firstCost = await token.read.calculatePurchaseCost([firstAmount]);
    await buyerToken.write.buyToken([firstAmount], { value: firstCost });

    // Now calculate cost for next 3 tokens (tokens 6, 7, 8)
    // Sum(i=6 to 8) of (a*i + b) = a*(6+7+8) + b*3 = a*21 + b*3
    const nextAmount = 3n;
    const nextCost = await token.read.calculatePurchaseCost([nextAmount]);
    const expectedNextCost = SLOPE * 21n + STARTING_PRICE * 3n;

    assert.equal(nextCost, expectedNextCost, "Cost for next tokens should be correct");

    console.log(`Cost for tokens 6-8: ${nextCost} wei`);
  });

  // ============================================
  // Buy Function Tests
  // ============================================

  it("Should refund excess ETH", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 1n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    const excessAmount = parseEther("1"); // Send way more than needed

    const balanceBefore = await publicClient.getBalance({ address: buyer1.account.address });
    const tx = await buyerToken.write.buyToken([amount], { value: excessAmount });
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const balanceAfter = await publicClient.getBalance({ address: buyer1.account.address });

    // Balance should decrease by cost + gas, not by excessAmount
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
    const expectedBalanceAfter = balanceBefore - cost - gasUsed;

    // Allow small tolerance for gas estimation
    const diff = balanceAfter > expectedBalanceAfter
      ? balanceAfter - expectedBalanceAfter
      : expectedBalanceAfter - balanceAfter;
    assert.ok(diff < parseEther("0.001"), "Should refund excess ETH");

    console.log(`Excess ETH refunded correctly`);
  });

  it("Should reject purchase with insufficient ETH", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 10n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    const insufficientAmount = cost - 1n; // 1 wei less than needed

    try {
      await buyerToken.write.buyToken([amount], { value: insufficientAmount });
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("Insufficient ETH"),
        "Should revert with insufficient ETH error"
      );
      console.log("Correctly rejected insufficient ETH");
    }
  });

  it("Should emit TokensPurchased event", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 5n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    const tx = await buyerToken.write.buyToken([amount], { value: cost });

    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "TokensPurchased",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(logs.length, 1, "Should emit one TokensPurchased event");
    assert.equal(
      logs[0].args.buyer?.toLowerCase(),
      buyer1.account.address.toLowerCase(),
      "Buyer should match"
    );
    assert.equal(logs[0].args.amount, amount, "Amount should match");
    assert.equal(logs[0].args.totalCost, cost, "Total cost should match");

    console.log(`TokensPurchased event emitted: ${amount} tokens for ${cost} wei`);
  });

  // ============================================
  // Sell Function Tests
  // ============================================

  it("Should allow selling tokens back", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    // First buy some tokens
    const buyAmount = 10n;
    const buyCost = await token.read.calculatePurchaseCost([buyAmount]);
    await buyerToken.write.buyToken([buyAmount], { value: buyCost });

    // Check balance before selling
    const balanceBefore = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(balanceBefore, buyAmount, "Should have bought tokens");

    // Sell half of them back
    const sellAmount = 5n;
    await buyerToken.write.sellToken([sellAmount]);

    const balanceAfter = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(balanceAfter, buyAmount - sellAmount, "Balance should decrease by sell amount");

    console.log(`Sold ${sellAmount} tokens, balance: ${balanceAfter}`);
  });

  // ============================================
  // Edge Cases
  // ============================================

  it("Should reject buying zero tokens", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    try {
      await buyerToken.write.buyToken([0n], { value: parseEther("1") });
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("Amount must be greater than 0"),
        "Should revert with zero amount error"
      );
      console.log("Correctly rejected zero amount");
    }
  });

  it("Should track tokensSold correctly", async function () {
    const { token } = await deployToken();

    const buyerToken = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    // Initial tokensSold should be 0
    let tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 0n, "Initial tokensSold should be 0");

    // Buy 5 tokens
    const amount1 = 5n;
    const cost1 = await token.read.calculatePurchaseCost([amount1]);
    await buyerToken.write.buyToken([amount1], { value: cost1 });

    tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 5n, "tokensSold should be 5");

    // Buy 3 more tokens
    const amount2 = 3n;
    const cost2 = await token.read.calculatePurchaseCost([amount2]);
    await buyerToken.write.buyToken([amount2], { value: cost2 });

    tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 8n, "tokensSold should be 8");

    console.log(`Total tokens sold: ${tokensSold}`);
  });
});
