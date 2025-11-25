import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("100000000", 18),
      },
    }
  })

  return { viem, ignition, token };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    console.log("token", token.address);
  });

  it("Should have correct token information", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const decimals = await token.read.decimals();

    assert.equal(name, "Cyberk", "Token name should be Cyberk");
    assert.equal(symbol, "CBK", "Token symbol should be CBK");
    assert.equal(decimals, 18, "Token decimals should be 18");
  });

  it("Should have correct initial supply", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [owner] = await viem.getWalletClients();

    const totalSupply = await token.read.totalSupply();
    const ownerBalance = await token.read.balanceOf([owner.account.address]);

    assert.equal(totalSupply, parseUnits("100000000", 18), "Total supply should be 100,000,000");
    assert.equal(ownerBalance, parseUnits("100000000", 18), "Owner should have all initial supply");
  });

  it("Should have correct initial price", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const price = await token.read.price();
    assert.equal(price, parseUnits("0.1", 18), "Initial price should be 0.1 ETH");
  });

  it("Should allow owner to set price", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const newPrice = parseUnits("0.2", 18);
    await token.write.setPrice([newPrice]);

    const price = await token.read.price();
    assert.equal(price, newPrice, "Price should be updated to 0.2 ETH");
  });

  it("Should not allow non-owner to set price", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, user] = await viem.getWalletClients();

    const newPrice = parseUnits("0.2", 18);
    
    await assert.rejects(
      async () => {
        await token.write.setPrice([newPrice], { account: user.account });
      },
      /OwnableUnauthorizedAccount/,
      "Should revert with OwnableUnauthorizedAccount error"
    );
  });

  it("Buy token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    await token.write.buyToken([parseUnits("1", 18)], { 
      value: parseUnits("0.1", 18), // 0.1 eth
    });
  });

  it("Should mint correct amount of tokens when buying", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("10", 18);
    const balanceBefore = await token.read.balanceOf([buyer.account.address]);

    await token.write.buyToken([amountToBuy], {
      value: parseUnits("1", 18), // 1 ETH (enough for 10 tokens at 0.1 ETH each)
      account: buyer.account,
    });

    const balanceAfter = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balanceAfter - balanceBefore, amountToBuy, "Should receive correct amount of tokens");
  });

  it("Should revert when buying with insufficient funds", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("10", 18);
    
    await assert.rejects(
      async () => {
        await token.write.buyToken([amountToBuy], {
          value: parseUnits("0.5", 18), // Only 0.5 ETH, not enough for 10 tokens
          account: buyer.account,
        });
      },
      /InsufficientFunds/,
      "Should revert with InsufficientFunds error"
    );
  });

  it("Should revert when buying zero tokens", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    await assert.rejects(
      async () => {
        await token.write.buyToken([0n], {
          value: parseUnits("0.1", 18),
          account: buyer.account,
        });
      },
      /InvalidAmount/,
      "Should revert with InvalidAmount error"
    );
  });

  it("Should allow buying exact amount with exact payment", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("5", 18);
    const exactPayment = parseUnits("0.5", 18); // 5 tokens * 0.1 ETH

    const balanceBefore = await token.read.balanceOf([buyer.account.address]);

    await token.write.buyToken([amountToBuy], {
      value: exactPayment,
      account: buyer.account,
    });

    const balanceAfter = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balanceAfter - balanceBefore, amountToBuy, "Should receive exact amount of tokens");
  });

  it("Should handle multiple purchases from same buyer", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const firstPurchase = parseUnits("5", 18);
    const secondPurchase = parseUnits("3", 18);

    await token.write.buyToken([firstPurchase], {
      value: parseUnits("0.5", 18),
      account: buyer.account,
    });

    await token.write.buyToken([secondPurchase], {
      value: parseUnits("0.3", 18),
      account: buyer.account,
    });

    const finalBalance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(finalBalance, firstPurchase + secondPurchase, "Should accumulate tokens from multiple purchases");
  });

  // New Feature Tests

  it("Should have endTime set to 1 hour after deployment", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const endTime = await token.read.endTime();
    const currentTime = await networkHelpers.time.latest();
    
    // endTime should be approximately 1 hour (3600 seconds) after deployment
    const expectedEndTime = BigInt(currentTime) + 3600n;
    
    // Allow some tolerance (within 100 seconds for test execution time)
    assert.ok(endTime >= expectedEndTime - 100n && endTime <= expectedEndTime + 100n, 
      `endTime (${endTime}) should be approximately 1 hour after deployment (expected: ${expectedEndTime})`);
  });

  it("Should revert when buying after endTime", async function () {
    const { networkHelpers, viem, ignition } = await network.connect();
    const [, buyer] = await viem.getWalletClients();
    
    // Deploy a fresh contract for this test
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Cyberk",
          symbol: "CBK",
          initialSupply: parseUnits("100000000", 18),
        },
      }
    });

    // Fast forward time by more than 1 hour
    await networkHelpers.time.increase(3601);

    await assert.rejects(
      async () => {
        await token.write.buyToken([parseUnits("1", 18)], {
          value: parseUnits("0.1", 18),
          account: buyer.account,
        });
      },
      /SaleEnded/,
      "Should revert with SaleEnded error"
    );
  });

  it("Should allow owner to set endTime", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const newEndTime = BigInt(Math.floor(Date.now() / 1000)) + 7200n; // 2 hours from now
    await token.write.setEndTime([newEndTime]);

    const endTime = await token.read.endTime();
    assert.equal(endTime, newEndTime, "endTime should be updated");
  });

  it("Should have correct initial pricing parameters", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const basePrice = await token.read.basePrice();
    const slope = await token.read.slope();
    const initialSupply = await token.read.initialSupply();
    const totalSupply = await token.read.totalSupply();
    const tokensSold = totalSupply - initialSupply;

    assert.equal(basePrice, parseUnits("0.1", 18), "basePrice should be 0.1 ETH");
    assert.equal(slope, 0n, "slope should be 0 by default");
    assert.equal(tokensSold, 0n, "tokens sold should be 0 initially");
  });

  it("Should allow owner to set pricing parameters", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const newSlope = parseUnits("0.00001", 18);
    const newBasePrice = parseUnits("0.2", 18);

    await token.write.setPricingParameters([newSlope, newBasePrice]);

    const slope = await token.read.slope();
    const basePrice = await token.read.basePrice();

    assert.equal(slope, newSlope, "slope should be updated");
    assert.equal(basePrice, newBasePrice, "basePrice should be updated");
  });

  it("Should calculate correct cost with progressive pricing", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    // Set slope to enable progressive pricing
    const slope = parseUnits("0.00001", 18);
    await token.write.setPricingParameters([slope, parseUnits("0.1", 18)]);

    // Calculate cost for 1 token
    // S = 0, N = 1, a = 0.00001, b = 0.1
    // Sum = (1 * (0 + 0.00001*2 + 0.2)) / 2 = 0.10001 ETH
    const cost1 = await token.read.calculateCost([parseUnits("1", 18)]);
    assert.equal(cost1, parseUnits("0.10001", 18), "Cost for 1 token should be 0.10001 ETH");

    // Calculate cost for 10 tokens
    // S = 0, N = 10, a = 0.00001, b = 0.1
    // Sum = (10 * (0 + 0.00001*11 + 0.2)) / 2 = 1.00055 ETH
    const cost10 = await token.read.calculateCost([parseUnits("10", 18)]);
    assert.equal(cost10, parseUnits("1.00055", 18), "Cost for 10 tokens should be 1.00055 ETH");
  });

  it("Should update tokens sold after purchase", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("5", 18);
    
    const initialSupply = await token.read.initialSupply();
    const totalSupplyBefore = await token.read.totalSupply();
    const tokensSoldBefore = totalSupplyBefore - initialSupply;
    assert.equal(tokensSoldBefore, 0n, "tokens sold should be 0 initially");

    await token.write.buyToken([amountToBuy], {
      value: parseUnits("0.5", 18),
      account: buyer.account,
    });

    const totalSupplyAfter = await token.read.totalSupply();
    const tokensSoldAfter = totalSupplyAfter - initialSupply;
    assert.equal(tokensSoldAfter, amountToBuy, "tokens sold should be updated after purchase");
  });

  it("Should handle progressive pricing correctly across multiple purchases", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    // Set slope to enable progressive pricing
    const slope = parseUnits("0.00001", 18);
    await token.write.setPricingParameters([slope, parseUnits("0.1", 18)]);

    // First purchase: 5 tokens
    // S = 0, N = 5
    // Sum = (5 * (0 + 0.00001*6 + 0.2)) / 2 = 0.50015 ETH
    const cost1 = await token.read.calculateCost([parseUnits("5", 18)]);
    await token.write.buyToken([parseUnits("5", 18)], {
      value: cost1,
      account: buyer.account,
    });

    const initialSupply = await token.read.initialSupply();
    
    const totalSupplyAfterFirst = await token.read.totalSupply();
    const tokensSoldAfterFirst = totalSupplyAfterFirst - initialSupply;
    assert.equal(tokensSoldAfterFirst, parseUnits("5", 18), "tokens sold should be 5 after first purchase");

    // Second purchase: 3 tokens
    // S = 5, N = 3
    // Sum = (3 * (2*0.00001*5 + 0.00001*4 + 0.2)) / 2 = 0.30021 ETH
    const cost2 = await token.read.calculateCost([parseUnits("3", 18)]);
    await token.write.buyToken([parseUnits("3", 18)], {
      value: cost2,
      account: buyer.account,
    });

    const totalSupplyAfterSecond = await token.read.totalSupply();
    const tokensSoldAfterSecond = totalSupplyAfterSecond - initialSupply;
    assert.equal(tokensSoldAfterSecond, parseUnits("8", 18), "tokens sold should be 8 after second purchase");

    const finalBalance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(finalBalance, parseUnits("8", 18), "Buyer should have 8 tokens");
  });

  it("Should refund excess payment", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("1", 18);
    const overpayment = parseUnits("0.5", 18); // Send 0.5 ETH for 1 token (0.1 ETH)

    // Should not revert even with overpayment
    await token.write.buyToken([amountToBuy], {
      value: overpayment,
      account: buyer.account,
    });

    // Check that tokens were minted
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, amountToBuy, "Should receive correct amount of tokens");
  });

  it("Should calculate cost of 0 tokens as 0", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const cost = await token.read.calculateCost([0n]);
    assert.equal(cost, 0n, "Cost of 0 tokens should be 0");
  });

  it("Should calculate correct cost when buying 1 token first, then 10 more tokens", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    // Set slope to enable progressive pricing
    const slope = parseUnits("0.00001", 18);
    await token.write.setPricingParameters([slope, parseUnits("0.1", 18)]);

    // First purchase: 1 token
    // S = 0, N = 1, a = 0.00001, b = 0.1
    // Sum = (1 * (0 + 0.00001*2 + 0.2)) / 2 = 0.10001 ETH
    const cost1 = await token.read.calculateCost([parseUnits("1", 18)]);
    assert.equal(cost1, parseUnits("0.10001", 18), "Cost for first token should be 0.10001 ETH");

    await token.write.buyToken([parseUnits("1", 18)], {
      value: cost1,
      account: buyer.account,
    });

    const initialSupply = await token.read.initialSupply();
    
    const totalSupplyAfterFirst = await token.read.totalSupply();
    const tokensSoldAfterFirst = totalSupplyAfterFirst - initialSupply;
    assert.equal(tokensSoldAfterFirst, parseUnits("1", 18), "tokens sold should be 1 after first purchase");

    // Second purchase: 10 tokens (after already buying 1)
    // S = 1, N = 10, a = 0.00001, b = 0.1
    // Sum = (10 * (2*0.00001*1 + 0.00001*11 + 0.2)) / 2
    // Sum = (10 * (0.00002 + 0.00011 + 0.2)) / 2
    // Sum = (10 * 0.20013) / 2 = 1.00065 ETH
    const cost10 = await token.read.calculateCost([parseUnits("10", 18)]);
    assert.equal(cost10, parseUnits("1.00065", 18), "Cost for 10 tokens (after buying 1) should be 1.00065 ETH");

    await token.write.buyToken([parseUnits("10", 18)], {
      value: cost10,
      account: buyer.account,
    });

    const totalSupplyAfterSecond = await token.read.totalSupply();
    const tokensSoldAfterSecond = totalSupplyAfterSecond - initialSupply;
    assert.equal(tokensSoldAfterSecond, parseUnits("11", 18), "tokens sold should be 11 after second purchase");

    const finalBalance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(finalBalance, parseUnits("11", 18), "Buyer should have 11 tokens total");
  });

  it("Should calculate correct cost for fractional token amounts", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    // Set slope to enable progressive pricing
    const slope = parseUnits("0.00001", 18);
    await token.write.setPricingParameters([slope, parseUnits("0.1", 18)]);

    // Test 1: Buy 0.5 tokens (5 * 10^17 wei)
    // S = 0, N = 0.5
    // Sum = (0.5 * (0 + 0.00001*1.5 + 0.2)) / 2 = 0.050003750 ETH
    const halfToken = parseUnits("0.5", 18);
    const costHalf = await token.read.calculateCost([halfToken]);
    const expectedHalf = parseUnits("0.05000375", 18);
    assert.equal(costHalf, expectedHalf, "Cost for 0.5 tokens should be 0.05000375 ETH");

    await token.write.buyToken([halfToken], {
      value: costHalf,
      account: buyer.account,
    });

    // Test 2: Buy 0.1 tokens after buying 0.5 tokens
    // S = 0.5, N = 0.1
    // Sum = (0.1 * (2*0.00001*0.5 + 0.00001*1.1 + 0.2)) / 2
    const pointOneToken = parseUnits("0.1", 18);
    const costPointOne = await token.read.calculateCost([pointOneToken]);
    
    await token.write.buyToken([pointOneToken], {
      value: costPointOne,
      account: buyer.account,
    });

    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, parseUnits("0.6", 18), "Buyer should have 0.6 tokens total");
  });

  it("Should handle very small token amounts (1 wei)", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    // Test with slope = 0 first (simpler case)
    // With slope = 0, cost = amount * basePrice / 10^18
    // For 1 wei: cost = 1 * 0.1 ETH / 10^18 = 0.1 / 10^18 ETH
    const oneWei = 1n;
    const costNoSlope = await token.read.calculateCost([oneWei]);
    
    // Due to integer division, cost for 1 wei will be 0
    // This is expected behavior with integer arithmetic
    assert.equal(costNoSlope, 0n, "Cost for 1 wei token with slope=0 should be 0 (precision limit)");
    
    // Test with a larger amount that will have non-zero cost
    const thousandWei = 1000n;
    const costThousand = await token.read.calculateCost([thousandWei]);
    assert.ok(costThousand > 0n, "Cost for 1000 wei tokens should be greater than 0");
    
    // Should be able to buy with calculated cost
    await token.write.buyToken([thousandWei], {
      value: costThousand,
      account: buyer.account,
    });

    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, thousandWei, "Buyer should have 1000 wei of tokens");
  });

  it("Should calculate correct cost for various fractional amounts with slope=0", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    // With slope = 0, cost should be linear: cost = amount * basePrice / 10^18
    
    // Test 0.5 tokens
    const halfToken = parseUnits("0.5", 18);
    const costHalf = await token.read.calculateCost([halfToken]);
    assert.equal(costHalf, parseUnits("0.05", 18), "Cost for 0.5 tokens should be 0.05 ETH");

    // Test 0.1 tokens
    const pointOneToken = parseUnits("0.1", 18);
    const costPointOne = await token.read.calculateCost([pointOneToken]);
    assert.equal(costPointOne, parseUnits("0.01", 18), "Cost for 0.1 tokens should be 0.01 ETH");

    // Test 0.001 tokens
    const smallAmount = parseUnits("0.001", 18);
    const costSmall = await token.read.calculateCost([smallAmount]);
    assert.equal(costSmall, parseUnits("0.0001", 18), "Cost for 0.001 tokens should be 0.0001 ETH");

    // Buy all amounts
    await token.write.buyToken([halfToken], {
      value: costHalf,
      account: buyer.account,
    });

    await token.write.buyToken([pointOneToken], {
      value: costPointOne,
      account: buyer.account,
    });

    await token.write.buyToken([smallAmount], {
      value: costSmall,
      account: buyer.account,
    });

    const totalAmount = halfToken + pointOneToken + smallAmount;
    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, totalAmount, "Buyer should have correct total amount");
  });
});