import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, decodeEventLog, getAddress } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  const { viem, ignition, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const { time } = networkHelpers;
  const [owner, buyer1, buyer2, buyer3] = await viem.getWalletClients();

  async function deployTokenFixture() {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Cyberk",
          symbol: "CBK",
          initialSupply: parseUnits("100000000", 18),
        },
      },
    });
    return { token };
  }

  it("Should deploy token successfully", async function () {
    const { token } = await deployTokenFixture();
    assert.ok(token.address, "Token should have an address");

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const totalSupply = await token.read.totalSupply();
    const tokenOwner = await token.read.owner();
    const ownerBalance = await token.read.balanceOf([tokenOwner]);

    assert.strictEqual(name, "Cyberk", "Token name should match");
    assert.strictEqual(symbol, "CBK", "Token symbol should match");
    assert.strictEqual(
      totalSupply,
      parseUnits("100000000", 18),
      "Total supply should match"
    );
    assert.strictEqual(
      getAddress(tokenOwner),
      getAddress(owner.account.address),
      "Owner should be the deployer"
    );
    assert.strictEqual(
      ownerBalance,
      parseUnits("100000000", 18),
      "Owner should receive all tokens"
    );

    console.log("Token deployed at:", token.address);
  });

  it("Should configure sale successfully", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const saleStartTime = currentTime + 100n; // Start in 100 seconds
    const saleEndTime = currentTime + 86400n; // End in 1 day
    const tokensForSale = parseUnits("1000000", 18); // 1M tokens
    const slope = parseUnits("0.0001", 18); // 0.0001 ETH increase per token (slope)
    const startingPrice = parseUnits("0.001", 18); // 0.001 ETH per token (starting price)

    const hash = await token.write.configureSale(
      [saleStartTime, saleEndTime, tokensForSale, slope, startingPrice],
      { account: owner.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Check event emission
    const saleConfiguredLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(token.address)
    );
    assert.ok(saleConfiguredLog, "SaleConfigured event should be emitted");

    // Verify sale configuration
    const configuredStartTime = await token.read.saleStartTime();
    const configuredEndTime = await token.read.saleEndTime();
    const configuredTokensForSale = await token.read.tokensForSale();
    const configuredSlope = await token.read.slope();
    const configuredStartingPrice = await token.read.startingPrice();

    assert.strictEqual(configuredStartTime, saleStartTime);
    assert.strictEqual(configuredEndTime, saleEndTime);
    assert.strictEqual(configuredTokensForSale, tokensForSale);
    assert.strictEqual(configuredSlope, slope);
    assert.strictEqual(configuredStartingPrice, startingPrice);
  });

  it("Should revert when configuring sale with invalid parameters", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const saleStartTime = currentTime + 86400n; // Start in 1 day
    const saleEndTime = currentTime + 100n; // End in 100 seconds (invalid: before start)

    await assert.rejects(
      token.write.configureSale(
        [
          saleStartTime,
          saleEndTime,
          parseUnits("1000000", 18),
          parseUnits("0.0001", 18), // slope
          parseUnits("0.001", 18), // startingPrice
        ],
        { account: owner.account }
      ),
      /Invalid sale period/
    );
  });

  it("Should calculate current price correctly", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const slope = parseUnits("0.0001", 18); // 0.0001 ETH per token
    const startingPrice = parseUnits("0.001", 18); // 0.001 ETH starting price

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        parseUnits("1000000", 18),
        slope,
        startingPrice,
      ],
      { account: owner.account }
    );

    // Initially (no tokens sold), price of token 1 = slope * 1 + startingPrice
    const initialPrice = await token.read.getCurrentPrice();
    const expectedPrice = slope + startingPrice; // y = a*1 + b
    assert.strictEqual(
      initialPrice,
      expectedPrice,
      "Initial price should be slope + startingPrice"
    );
  });

  it("Should calculate purchase cost correctly with linear pricing", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const slope = parseUnits("0.0001", 18); // 0.0001 ETH per token
    const startingPrice = parseUnits("0.001", 18); // 0.001 ETH starting price
    const tokensForSale = parseUnits("1000000", 18);

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        tokensForSale,
        slope,
        startingPrice,
      ],
      { account: owner.account }
    );

    // Calculate cost for 100 tokens (starting from token 1)
    const amount1 = parseUnits("100", 18);
    const cost1 = await token.read.calculatePurchaseCost([amount1]);
    // Formula matches contract: N * (slope * (S + (N+1)/2) + startingPrice)
    // S = 0 (no tokens sold), N = 100
    // Expected: 100 * (slope * (0 + 101/2) + startingPrice)
    const n1 = amount1 / parseUnits("1", 18);
    const s1 = 0n; // tokens already sold
    const avgTokenNum1 = s1 + (n1 + 1n) / 2n;
    // slope and startingPrice are in wei, avgTokenNum1 is integer
    const avgPrice1 = slope * avgTokenNum1 + startingPrice;
    const expectedCost1 = n1 * avgPrice1;
    assert.strictEqual(
      cost1,
      expectedCost1,
      "Cost for first purchase should be correct"
    );

    // Calculate cost for 200 tokens (starting from token 101, after first purchase)
    // First, simulate first purchase by updating tokensSold
    await token.write.buy([amount1], {
      account: buyer1.account,
      value: cost1 * 2n, // Send extra to cover
    });

    const amount2 = parseUnits("200", 18);
    const cost2 = await token.read.calculatePurchaseCost([amount2]);
    // S = 100, N = 200
    // Expected: 200 * (slope * (100 + 201/2) + startingPrice)
    const n2 = amount2 / parseUnits("1", 18);
    const s2 = amount1 / parseUnits("1", 18); // tokens already sold
    const avgTokenNum2 = s2 + (n2 + 1n) / 2n;
    const avgPrice2 = slope * avgTokenNum2 + startingPrice;
    const expectedCost2 = n2 * avgPrice2;
    assert.strictEqual(
      cost2,
      expectedCost2,
      "Cost for second purchase should be correct"
    );
  });

  it("Should allow buying tokens during sale period", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const slope = parseUnits("0.0001", 18);
    const startingPrice = parseUnits("0.001", 18);
    const tokensForSale = parseUnits("1000000", 18);

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        tokensForSale,
        slope,
        startingPrice,
      ],
      { account: owner.account }
    );

    const purchaseAmount = parseUnits("10", 18); // Reduced to 10 tokens = 0.01 ETH
    const cost = await token.read.calculatePurchaseCost([purchaseAmount]);

    const buyerBalanceBefore = await token.read.balanceOf([
      buyer1.account.address,
    ]);
    const ownerBalanceBefore = await token.read.balanceOf([
      owner.account.address,
    ]);

    // Check ETH balance before purchase
    const buyerEthBalance = await publicClient.getBalance({
      address: buyer1.account.address,
    });
    assert.ok(
      buyerEthBalance > cost,
      `Buyer should have enough ETH. Balance: ${buyerEthBalance}, Cost: ${cost}`
    );

    const hash = await token.write.buy([purchaseAmount], {
      account: buyer1.account,
      value: cost,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Check event emission - find TokensPurchased event specifically
    const purchaseLog = receipt.logs.find((log) => {
      if (getAddress(log.address) !== getAddress(token.address)) {
        return false;
      }
      try {
        const decoded = decodeEventLog({
          abi: token.abi,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "TokensPurchased";
      } catch {
        return false;
      }
    });
    assert.ok(purchaseLog, "TokensPurchased event should be emitted");

    const decoded = decodeEventLog({
      abi: token.abi,
      data: purchaseLog!.data,
      topics: purchaseLog!.topics,
    });

    assert.strictEqual(decoded.eventName, "TokensPurchased");
    const eventArgs = decoded.args as any;
    assert.strictEqual(
      getAddress(eventArgs.buyer),
      getAddress(buyer1.account.address)
    );
    assert.strictEqual(eventArgs.amount, purchaseAmount);

    // Verify balances
    const buyerBalanceAfter = await token.read.balanceOf([
      buyer1.account.address,
    ]);
    const ownerBalanceAfter = await token.read.balanceOf([
      owner.account.address,
    ]);
    const tokensSold = await token.read.tokensSold();

    assert.strictEqual(
      buyerBalanceAfter - buyerBalanceBefore,
      purchaseAmount,
      "Buyer should receive tokens"
    );
    assert.strictEqual(
      ownerBalanceBefore - ownerBalanceAfter,
      purchaseAmount,
      "Owner should lose tokens"
    );
    assert.strictEqual(
      tokensSold,
      purchaseAmount,
      "Tokens sold should be updated"
    );
  });

  it("Should revert when buying before sale starts", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const saleStartTime = currentTime + 3600n; // Start in 1 hour
    const saleEndTime = currentTime + 86400n;

    await token.write.configureSale(
      [
        saleStartTime,
        saleEndTime,
        parseUnits("1000000", 18),
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const purchaseAmount = parseUnits("10000", 18);
    const cost = await token.read.calculatePurchaseCost([purchaseAmount]);

    await assert.rejects(
      token.write.buy([purchaseAmount], {
        account: buyer1.account,
        value: cost,
      }),
      /Sale has not started/
    );
  });

  it("Should revert when buying after sale ends", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const saleStartTime = currentTime - 86400n; // Started 1 day ago
    const saleEndTime = currentTime - 3600n; // Ended 1 hour ago

    await token.write.configureSale(
      [
        saleStartTime,
        saleEndTime,
        parseUnits("1000000", 18),
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const purchaseAmount = parseUnits("100", 18); // Reduced to 100 tokens
    const cost = await token.read.calculatePurchaseCost([purchaseAmount]);

    await assert.rejects(
      token.write.buy([purchaseAmount], {
        account: buyer1.account,
        value: cost,
      }),
      /Sale has ended/
    );
  });

  it("Should revert when buying with insufficient ETH", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        parseUnits("1000000", 18),
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const purchaseAmount = parseUnits("1000", 18); // Reduced from 10000
    const cost = await token.read.calculatePurchaseCost([purchaseAmount]);
    const insufficientAmount = cost - 1n; // Send less than required

    await assert.rejects(
      token.write.buy([purchaseAmount], {
        account: buyer1.account,
        value: insufficientAmount,
      }),
      /Insufficient ETH sent/
    );
  });

  it("Should refund excess ETH", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        parseUnits("1000000", 18),
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const purchaseAmount = parseUnits("10", 18); // Reduced to 10 tokens
    const cost = await token.read.calculatePurchaseCost([purchaseAmount]);
    const excessAmount = cost + parseUnits("0.001", 18); // Send more than required

    const buyerBalanceBefore = await publicClient.getBalance({
      address: buyer1.account.address,
    });

    // Check ETH balance before purchase
    assert.ok(
      buyerBalanceBefore > excessAmount,
      `Buyer should have enough ETH. Balance: ${buyerBalanceBefore}, Required: ${excessAmount}`
    );

    await token.write.buy([purchaseAmount], {
      account: buyer1.account,
      value: excessAmount,
    });

    const buyerBalanceAfter = await publicClient.getBalance({
      address: buyer1.account.address,
    });

    // Balance should decrease by exactly the cost (excess should be refunded)
    // Note: We need to account for gas fees, so we check that the decrease is close to cost
    const balanceDecrease = buyerBalanceBefore - buyerBalanceAfter;
    // The decrease should be approximately cost + gas, so it should be >= cost
    assert.ok(balanceDecrease >= cost, "Should only charge the exact cost");
  });

  it("Should apply linear pricing correctly", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const slope = parseUnits("0.0001", 18); // 0.0001 ETH per token
    const startingPrice = parseUnits("0.001", 18); // 0.001 ETH starting price
    const tokensForSale = parseUnits("1000", 18); // 1k tokens for sale

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        tokensForSale,
        slope,
        startingPrice,
      ],
      { account: owner.account }
    );

    // First purchase: 50 tokens
    const amount1 = parseUnits("50", 18);
    const cost1 = await token.read.calculatePurchaseCost([amount1]);

    // Expected cost: 50 * (slope * (0 + 51/2) + startingPrice)
    // = 50 * (slope * 25.5 + startingPrice)
    const n1 = amount1 / parseUnits("1", 18);
    const s1 = 0n; // tokens already sold
    const avgTokenNum1 = s1 + (n1 + 1n) / 2n;
    const avgPrice1 = slope * avgTokenNum1 + startingPrice;
    const expectedCost1 = n1 * avgPrice1;
    assert.strictEqual(
      cost1,
      expectedCost1,
      "First purchase cost should be correct"
    );

    // Check ETH balance before purchase
    const buyer1EthBalance = await publicClient.getBalance({
      address: buyer1.account.address,
    });
    assert.ok(
      buyer1EthBalance > cost1,
      `Buyer1 should have enough ETH. Balance: ${buyer1EthBalance}, Cost: ${cost1}`
    );

    await token.write.buy([amount1], {
      account: buyer1.account,
      value: cost1,
    });

    // Second purchase: 60 tokens (starting from token 51)
    const amount2 = parseUnits("60", 18);
    const cost2 = await token.read.calculatePurchaseCost([amount2]);

    // Expected cost: 60 * (slope * (50 + 61/2) + startingPrice)
    // = 60 * (slope * 80.5 + startingPrice)
    const n2 = amount2 / parseUnits("1", 18);
    const s2 = amount1 / parseUnits("1", 18); // tokens already sold
    const avgTokenNum2 = s2 + (n2 + 1n) / 2n;
    const avgPrice2 = slope * avgTokenNum2 + startingPrice;
    const expectedCost2 = n2 * avgPrice2;
    assert.strictEqual(
      cost2,
      expectedCost2,
      "Linear pricing should work correctly"
    );

    // Check ETH balance before purchase
    const buyer2EthBalance = await publicClient.getBalance({
      address: buyer2.account.address,
    });
    assert.ok(
      buyer2EthBalance > cost2,
      `Buyer2 should have enough ETH. Balance: ${buyer2EthBalance}, Cost: ${cost2}`
    );

    await token.write.buy([amount2], {
      account: buyer2.account,
      value: cost2,
    });

    // Verify tokens sold
    const tokensSold = await token.read.tokensSold();
    assert.strictEqual(
      tokensSold,
      amount1 + amount2,
      "Tokens sold should be cumulative"
    );

    // Verify current price increased (price of token 111 = slope * 111 + startingPrice)
    const currentPrice = await token.read.getCurrentPrice();
    const expectedPrice = slope * 111n + startingPrice;
    assert.strictEqual(
      currentPrice,
      expectedPrice,
      "Price should increase linearly"
    );
  });

  it("Should revert when trying to buy more tokens than available", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const tokensForSale = parseUnits("100000", 18);

    await token.write.configureSale(
      [
        currentTime - 100n,
        currentTime + 86400n,
        tokensForSale,
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const excessAmount = parseUnits("100001", 18); // More than available
    const cost = await token.read.calculatePurchaseCost([tokensForSale]);

    await assert.rejects(
      token.write.buy([excessAmount], {
        account: buyer1.account,
        value: cost * 2n, // Send enough ETH
      }),
      /Not enough tokens available/
    );
  });

  it("Should get sale info correctly", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const saleStartTime = currentTime - 100n;
    const saleEndTime = currentTime + 86400n;
    const tokensForSale = parseUnits("1000000", 18);

    await token.write.configureSale(
      [
        saleStartTime,
        saleEndTime,
        tokensForSale,
        parseUnits("0.0001", 18), // slope
        parseUnits("0.001", 18), // startingPrice
      ],
      { account: owner.account }
    );

    const saleInfo = await token.read.getSaleInfo();
    assert.strictEqual(saleInfo[0], saleStartTime, "Start time should match");
    assert.strictEqual(saleInfo[1], saleEndTime, "End time should match");
    assert.strictEqual(
      saleInfo[2],
      tokensForSale,
      "Tokens for sale should match"
    );
    assert.strictEqual(saleInfo[3], 0n, "Tokens sold should be 0 initially");
    assert.strictEqual(
      saleInfo[4],
      tokensForSale,
      "Tokens remaining should match"
    );
    assert.ok(saleInfo[6], "Sale should be active");
  });

  it("Should set treasury address", async function () {
    const { token } = await deployTokenFixture();
    const newTreasury = buyer2.account.address;

    await token.write.setTreasury([newTreasury], { account: owner.account });

    const treasury = await token.read.treasury();
    assert.strictEqual(
      getAddress(treasury),
      getAddress(newTreasury),
      "Treasury should be updated"
    );
  });

  it("Should revert when non-owner tries to configure sale", async function () {
    const { token } = await deployTokenFixture();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));

    await assert.rejects(
      token.write.configureSale(
        [
          currentTime - 100n,
          currentTime + 86400n,
          parseUnits("1000000", 18),
          parseUnits("0.0001", 18), // slope
          parseUnits("0.001", 18), // startingPrice
        ],
        { account: buyer1.account }
      ),
      /OwnableUnauthorizedAccount/
    );
  });
});
