import assert from "node:assert/strict";
import { describe, it } from "node:test";
import TokenModule from "../ignition/modules/Token.js";
import MockUSDTModule from "../ignition/modules/MockUSDT.js";

import { network } from "hardhat";
import { parseUnits, type Address } from "viem";
import {
  captureBalances,
  assertErc20BalancesHaveChanged,
  withBalanceTracking,
} from "../plugins/viem-test.js";

describe("Token with ERC20 Payment and Bonding Curve", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, buyer1, buyer2] = await viem.getWalletClients();

  const ONE_HOUR = 3600n;
  // For ~0.00005 ETH first token: a*1 + b = 0.00005 ETH
  // Let's use: slope = 0.000001 USDT, startingPrice = 0.000049 USDT (6 decimals)
  // First token price = 0.000001 + 0.000049 = 0.00005 (in USDT terms with 6 decimals)
  const SLOPE = parseUnits("0.000001", 6); // 1 wei in 6 decimals
  const STARTING_PRICE = parseUnits("0.000049", 6); // ~0.000049 USDT

  async function getCurrentTimestamp(): Promise<bigint> {
    const block = await publicClient.getBlock();
    return block.timestamp;
  }

  async function deployMockUSDT() {
    const { mockUSDT } = await ignition.deploy(MockUSDTModule, {
      parameters: {
        MockUSDTModule: {
          decimals: 6,
        },
      },
    });
    return mockUSDT;
  }

  async function deployToken(
    paymentTokenAddress: Address,
    endTimeOffset: bigint = ONE_HOUR
  ) {
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
          paymentToken: paymentTokenAddress,
        },
      },
    });

    return { token, endTime };
  }

  // Deployment Tests
  it("Should deploy with correct parameters", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token, endTime } = await deployToken(mockUSDT.address);

    const actualEndTime = await token.read.endTime();
    const actualSlope = await token.read.slope();
    const actualStartingPrice = await token.read.startingPrice();
    const actualTokensSold = await token.read.tokensSold();
    const actualPaymentToken = await token.read.paymentToken();

    assert.equal(actualEndTime, endTime);
    assert.equal(actualSlope, SLOPE);
    assert.equal(actualStartingPrice, STARTING_PRICE);
    assert.equal(actualTokensSold, 0n);
    assert.equal(
      actualPaymentToken.toLowerCase(),
      mockUSDT.address.toLowerCase()
    );
  });

  it("Should mint initial supply to deployer", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);
    const initialSupply = parseUnits("1000", 18);

    const balance = await token.read.balanceOf([deployer.account.address]);
    assert.equal(balance, initialSupply);
  });

  // getCost function tests
  it("Should calculate getCost correctly for first token", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    // getCost(0, 1, slope, startingPrice) should equal slope*1 + startingPrice
    const cost = await token.read.getCost([0n, 1n, SLOPE, STARTING_PRICE]);
    const expectedCost = SLOPE * 1n + STARTING_PRICE;
    assert.equal(cost, expectedCost);
  });

  it("Should calculate getCost correctly for multiple tokens", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    // getCost(0, 5, slope, startingPrice)
    // Sum(i=1 to 5) of (a*i + b) = a*(1+2+3+4+5) + b*5 = a*15 + b*5
    const cost = await token.read.getCost([0n, 5n, SLOPE, STARTING_PRICE]);
    const expectedCost = SLOPE * 15n + STARTING_PRICE * 5n;
    assert.equal(cost, expectedCost);
  });

  it("Should calculate getCost correctly with non-zero starting position", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    // getCost(5, 3, slope, startingPrice) - buying tokens 6, 7, 8
    // Sum(i=6 to 8) of (a*i + b) = a*(6+7+8) + b*3 = a*21 + b*3
    const cost = await token.read.getCost([5n, 3n, SLOPE, STARTING_PRICE]);
    const expectedCost = SLOPE * 21n + STARTING_PRICE * 3n;
    assert.equal(cost, expectedCost);
  });

  it("Should return 0 for getCost with zero amount", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const cost = await token.read.getCost([0n, 0n, SLOPE, STARTING_PRICE]);
    assert.equal(cost, 0n);
  });

  // Buy with ERC20 tests
  it("Should allow buying with ERC20 payment", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("1000", 6),
    ]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 1n;
    const cost = await token.read.calculatePurchaseCost([amount]);

    await buyer1USDT.write.approve([token.address, cost]);
    await buyer1Token.write.buyToken([amount]);

    const buyerBalance = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(buyerBalance, amount);
  });

  // erc20BalancesHaveChanged assertion tests
  it("Should track ERC20 balance changes correctly", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    const mintAmount = parseUnits("1000", 6);
    await deployerUSDT.write.mint([buyer1.account.address, mintAmount]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 5n;
    const cost = await token.read.calculatePurchaseCost([amount]);

    await buyer1USDT.write.approve([token.address, cost]);

    await withBalanceTracking(
      publicClient,
      [mockUSDT.address as Address],
      [buyer1.account.address, token.address],
      async () => {
        await buyer1Token.write.buyToken([amount]);
      },
      [
        {
          account: buyer1.account.address,
          token: mockUSDT.address as Address,
          delta: -cost,
        },
        {
          account: token.address,
          token: mockUSDT.address as Address,
          delta: cost,
        },
      ]
    );
  });

  // Progressive pricing tests
  it("Should increase price as tokens are sold", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("10000", 6),
    ]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const priceBefore = await token.read.getCurrentPrice();

    const amount = 10n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    await buyer1USDT.write.approve([token.address, cost]);
    await buyer1Token.write.buyToken([amount]);

    const priceAfter = await token.read.getCurrentPrice();

    assert.ok(priceAfter > priceBefore);
    const expectedIncrease = SLOPE * amount;
    const actualIncrease = priceAfter - priceBefore;
    assert.equal(actualIncrease, expectedIncrease);
  });

  // Sell token tests
  it("Should allow selling tokens back", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("10000", 6),
    ]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const buyAmount = 10n;
    const buyCost = await token.read.calculatePurchaseCost([buyAmount]);
    await buyer1USDT.write.approve([token.address, buyCost]);
    await buyer1Token.write.buyToken([buyAmount]);

    const balanceBefore = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(balanceBefore, buyAmount);

    const sellAmount = 5n;
    await buyer1Token.write.sellToken([sellAmount]);

    const balanceAfter = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(balanceAfter, buyAmount - sellAmount);
  });

  // Event emission tests
  it("Should emit TokensPurchased event", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("1000", 6),
    ]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    const amount = 5n;
    const cost = await token.read.calculatePurchaseCost([amount]);
    await buyer1USDT.write.approve([token.address, cost]);
    const tx = await buyer1Token.write.buyToken([amount]);

    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "TokensPurchased",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(logs.length, 1);
    assert.equal(
      logs[0].args.buyer?.toLowerCase(),
      buyer1.account.address.toLowerCase()
    );
    assert.equal(logs[0].args.amount, amount);
    assert.equal(logs[0].args.totalCost, cost);
  });

  // Edge cases
  it("Should reject buying zero tokens", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    try {
      await buyer1Token.write.buyToken([0n]);
      assert.fail("Should have reverted");
    } catch (error: unknown) {
      const err = error as Error;
      assert.ok(err.message.includes("Amount must be greater than 0"));
    }
  });

  it("Should reject buying without approval", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("1000", 6),
    ]);

    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    try {
      await buyer1Token.write.buyToken([1n]);
      assert.fail("Should have reverted");
    } catch (error: unknown) {
      const err = error as Error;
      assert.ok(err.message.includes("ERC20InsufficientAllowance"));
    }
  });

  it("Should track tokensSold correctly", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const deployerUSDT = await viem.getContractAt(
      "MockUSDT",
      mockUSDT.address,
      {
        client: { wallet: deployer },
      }
    );
    await deployerUSDT.write.mint([
      buyer1.account.address,
      parseUnits("10000", 6),
    ]);

    const buyer1USDT = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer1 },
    });
    const buyer1Token = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer1 },
    });

    let tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 0n);

    const amount1 = 5n;
    const cost1 = await token.read.calculatePurchaseCost([amount1]);
    await buyer1USDT.write.approve([token.address, cost1]);
    await buyer1Token.write.buyToken([amount1]);

    tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 5n);

    const amount2 = 3n;
    const cost2 = await token.read.calculatePurchaseCost([amount2]);
    await buyer1USDT.write.approve([token.address, cost2]);
    await buyer1Token.write.buyToken([amount2]);

    tokensSold = await token.read.tokensSold();
    assert.equal(tokensSold, 8n);
  });

  it("Should verify first token price is approximately 0.00005", async function () {
    const mockUSDT = await deployMockUSDT();
    const { token } = await deployToken(mockUSDT.address);

    const firstTokenCost = await token.read.getCost([
      0n,
      1n,
      SLOPE,
      STARTING_PRICE,
    ]);
    // slope = 1 (0.000001 * 1e6), startingPrice = 49 (0.000049 * 1e6)
    // First token = 1 + 49 = 50 = 0.00005 USDT (in 6 decimals)
    const expectedFirstTokenCost = parseUnits("0.00005", 6);
    assert.equal(firstTokenCost, expectedFirstTokenCost);
  });
});
