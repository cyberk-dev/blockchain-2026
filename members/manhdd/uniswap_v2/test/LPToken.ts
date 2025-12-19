import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, getAddress } from "viem";
import { network } from "hardhat";
import { extractEvent } from "./utils.js";

describe("Token", async function () {
  const connection = await network.connect();
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  async function deployFixture() {
    const [owner] = await viem.getWalletClients();

    const tokenA = await viem.deployContract("Token", [
      "USDT",
      "USDT",
      parseUnits("1000000", 18),
    ]);
    const tokenB = await viem.deployContract("Token", [
      "USDC",
      "USDC",
      parseUnits("1000000", 18),
    ]);

    const lpToken = await viem.deployContract("LPToken", [
      tokenA.address,
      tokenB.address,
    ]);

    return { owner, lpToken, tokenA, tokenB };
  }

  it("should deploy LPToken contract", async function () {
    const { lpToken, tokenA, tokenB } = await deployFixture();

    assert.equal(
      getAddress(await lpToken.read.tokenA()),
      getAddress(tokenA.address)
    );
    assert.equal(
      getAddress(await lpToken.read.tokenB()),
      getAddress(tokenB.address)
    );
  });

  it("should add liquidity and mint lp tokens", async function () {
    const { owner, lpToken, tokenA, tokenB } = await deployFixture();

    await tokenA.write.approve([lpToken.address, parseUnits("1000", 18)]);
    await tokenB.write.approve([lpToken.address, parseUnits("1000", 18)]);

    const tx = lpToken.write.addLiquidity([1000n, 2000n]);

    await viem.assertions.erc20BalancesHaveChanged(tx, tokenA.address, [
      { address: owner.account.address, amount: -1000n },
      { address: lpToken.address, amount: 1000n },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(tx, tokenB.address, [
      { address: owner.account.address, amount: -2000n },
      { address: lpToken.address, amount: 2000n },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(tx, lpToken.address, [
      { address: owner.account.address, amount: 1414n },
    ]);

    const reserveA = await lpToken.read.reserveA();
    const reserveB = await lpToken.read.reserveB();

    assert.equal(reserveA, 1000n, "Reserve A should be 1000");
    assert.equal(reserveB, 2000n, "Reserve B should be 2000");
  });

  it("should check for balance when adding liquidity", async function () {
    const { owner, lpToken, tokenA, tokenB } = await deployFixture();

    await tokenA.write.approve([lpToken.address, parseUnits("1000000", 18)]);
    await tokenB.write.approve([lpToken.address, parseUnits("1000000", 18)]);

    await assert.rejects(
      async () => {
        await lpToken.write.addLiquidity([
          parseUnits("1000001", 18),
          parseUnits("1000001", 18),
        ]);
      },
      (err: any) => /InsufficientBalance/.test(String(err?.message)),
      "Expected revert with InsufficientBalance"
    );
  });

  it("should remove liquidity and burn lp tokens", async function () {
    const { owner, lpToken, tokenA, tokenB } = await deployFixture();

    await tokenA.write.approve([lpToken.address, parseUnits("1000", 18)]);
    await tokenB.write.approve([lpToken.address, parseUnits("1000", 18)]);

    await lpToken.write.addLiquidity([1000n, 2000n]);

    await lpToken.write.approve([lpToken.address, 1414n]);

    const tx = lpToken.write.removeLiquidity([1414n]);

    await viem.assertions.erc20BalancesHaveChanged(tx, tokenA.address, [
      { address: owner.account.address, amount: 1000n },
      { address: lpToken.address, amount: -1000n },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(tx, tokenB.address, [
      { address: owner.account.address, amount: 2000n },
      { address: lpToken.address, amount: -2000n },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(tx, lpToken.address, [
      { address: owner.account.address, amount: -1414n },
    ]);

    const reserveA = await lpToken.read.reserveA();
    const reserveB = await lpToken.read.reserveB();

    assert.equal(reserveA, 0n, "Reserve A should be 0");
    assert.equal(reserveB, 0n, "Reserve B should be 0");
  });

  it("should swap exact in successfully", async function () {
    const { owner, lpToken, tokenA, tokenB } = await deployFixture();

    await tokenA.write.approve([lpToken.address, parseUnits("1000", 18)]);
    await tokenB.write.approve([lpToken.address, parseUnits("1000", 18)]);

    await lpToken.write.addLiquidity([1000n, 2000n]);

    const amountIn = 100n;
    const expectedAmountOut = await lpToken.read.getAmountOut([
      amountIn,
      tokenA.address,
    ]);

    console.log("Expected Amount Out:", expectedAmountOut);

    const swapTx = lpToken.write.swapExactIn([
      tokenA.address,
      amountIn,
      tokenB.address,
      0n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenA.address, [
      { address: owner.account.address, amount: -amountIn },
      { address: lpToken.address, amount: amountIn },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenB.address, [
      { address: owner.account.address, amount: expectedAmountOut },
      { address: lpToken.address, amount: -expectedAmountOut },
    ]);
  });

  it("should swap exact out successfully", async function () {
    const { owner, lpToken, tokenA, tokenB } = await deployFixture();

    await tokenA.write.approve([lpToken.address, parseUnits("1000", 18)]);
    await tokenB.write.approve([lpToken.address, parseUnits("1000", 18)]);

    await lpToken.write.addLiquidity([1000n, 2000n]);

    const amountOut = 100n;
    const expectedAmountIn = await lpToken.read.getAmountIn([
      amountOut,
      tokenB.address,
    ]);

    console.log("Expected Amount In:", expectedAmountIn);

    const swapTx = lpToken.write.swapExactOut([
      tokenA.address,
      expectedAmountIn,
      tokenB.address,
      amountOut,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenA.address, [
      { address: owner.account.address, amount: -expectedAmountIn },
      { address: lpToken.address, amount: expectedAmountIn },
    ]);

    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenB.address, [
      { address: owner.account.address, amount: amountOut },
      { address: lpToken.address, amount: -amountOut },
    ]);
  });
});
