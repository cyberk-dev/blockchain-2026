import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { parseUnits, formatEther, getAddress, decodeEventLog } from "viem";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  let deployedToken: any;
  const SLOPE = 10n ** 22n; // slope = 1e22
  const BASE_PRICE = 1n; // basePrice = 1 wei (giá token đầu tiên từ 1 wei)

  before(async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "THAI",
          symbol: "TDQ",
          initialSupply: parseUnits("100000", 18),
          slope: SLOPE,
          basePrice: BASE_PRICE,
        },
      },
    });
    deployedToken = token;
    
    // Verify slope and basePrice
    const a = await (token.read as any).a();
    const b = await (token.read as any).b();
    console.log(`Slope (a): ${a.toString()}, Base Price (b): ${b.toString()} wei`);
    assert.equal(a, BigInt(SLOPE), "Slope should be 1e22");
    assert.equal(b, BigInt(BASE_PRICE), "Base price should be 1 wei");
  });

  it("deploys token via ignition", async function () {
    assert.ok(deployedToken?.address, "Token should be deployed");
    const endTime = await (deployedToken.read as any).endTime();
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    assert.ok(endTime > currentTime && endTime <= currentTime + 3600n + 100n, "endTime should be ~1 hour from deployment");
    
    // Verify giá token đầu tiên (với slope = 1e22, giá sẽ rất lớn)
    const firstTokenPrice = await (deployedToken.read as any).getTokenPrice([1]);
    console.log(`Giá token đầu tiên: ${firstTokenPrice.toString()} wei (${formatEther(firstTokenPrice)} ETH)`);
    // Với slope = 1e22 và basePrice = 1, giá token đầu tiên = 1e22 + 1 wei
    assert.equal(firstTokenPrice, SLOPE + BASE_PRICE, "Giá token đầu tiên = slope + basePrice");
  });

  it("allows a buyer to purchase tokens", async function () {
    const [buyer] = await viem.getWalletClients();
    const tokensToBuy = parseUnits("10", 18);
    const initialBalance = await deployedToken.read.balanceOf([buyer.account.address]);
    const totalSoldBefore = await (deployedToken.read as any).totalSold();

    const requiredEth = await (deployedToken.read as any).calculateCost([tokensToBuy]);
    const tx = await (deployedToken.write as any).buyToken([tokensToBuy], { value: requiredEth });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const finalBalance = await deployedToken.read.balanceOf([buyer.account.address]);
    const totalSoldAfter = await (deployedToken.read as any).totalSold();

    assert.equal(finalBalance - initialBalance, tokensToBuy, "Buyer should receive exact tokens");
    assert.equal(totalSoldAfter, totalSoldBefore + tokensToBuy, "totalSold should increase");
  });

  it("should have progressive pricing", async function () {
    const [buyer1, buyer2] = await viem.getWalletClients();
    const tokens = parseUnits("5", 18);
    
    const cost1 = await (deployedToken.read as any).calculateCost([tokens]);
    const price1 = await (deployedToken.read as any).getCurrentPrice();
    const tx1 = await (deployedToken.write as any).buyToken([tokens], { account: buyer1.account, value: cost1 });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });

    const cost2 = await (deployedToken.read as any).calculateCost([tokens]);
    const price2 = await (deployedToken.read as any).getCurrentPrice();
    const tx2 = await (deployedToken.write as any).buyToken([tokens], { account: buyer2.account, value: cost2 });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    assert.ok(price2 > price1, "Price should increase");
    assert.ok(cost2 > cost1, "Cost should increase");
  });

  it("should set endTime correctly", async function () {
    const endTime = await (deployedToken.read as any).endTime();
    const block = await publicClient.getBlock({ blockNumber: await publicClient.getBlockNumber() });
    const currentTime = BigInt(block.timestamp);
    const diff = endTime > currentTime + 3600n ? endTime - (currentTime + 3600n) : (currentTime + 3600n) - endTime;
    assert.ok(diff <= 10n && endTime > currentTime, "endTime should be ~1 hour in future");
  });

  it("should allow buying tokens before endTime", async function () {
    const [buyer] = await viem.getWalletClients();
    const tokensToBuy = parseUnits("1", 18);
    const requiredCost = await (deployedToken.read as any).calculateCost([tokensToBuy]);
    const initialBalance = await deployedToken.read.balanceOf([buyer.account.address]);

    const tx = await (deployedToken.write as any).buyToken([tokensToBuy], { account: buyer.account, value: requiredCost });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const finalBalance = await deployedToken.read.balanceOf([buyer.account.address]);
    assert.equal(finalBalance - initialBalance, tokensToBuy, "Should buy tokens before endTime");
  });

  it("should have endTime protection", async function () {
    const { token: testToken } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "TestToken",
          symbol: "TEST",
          initialSupply: parseUnits("1000", 18),
          slope: SLOPE,
          basePrice: BASE_PRICE,
        },
      },
    });
    const endTime = await (testToken.read as any).endTime();
    const block = await publicClient.getBlock({ blockNumber: await publicClient.getBlockNumber() });
    assert.ok(endTime > BigInt(block.timestamp), "endTime should be set");
  });
});
