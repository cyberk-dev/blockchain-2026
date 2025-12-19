import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";

describe("LPToken", async function () {
  const { viem, networkHelpers } = await network.connect();
  const [owner, receiver] = await viem.getWalletClients();

  async function deployFixture() {
    const tokenX = await viem.deployContract("MockUSDT");
    const tokenY = await viem.deployContract("MockUSDT");

    const mintAmount = parseUnits("1000", 6);
    await tokenX.write.mint([owner.account.address, mintAmount], {
      account: owner.account,
    });
    await tokenY.write.mint([owner.account.address, mintAmount], {
      account: owner.account,
    });

    const lpToken = await viem.deployContract("LPToken", [
      tokenX.address,
      tokenY.address,
    ]);

    return { lpToken, tokenX, tokenY };
  }

  let lpToken: Awaited<ReturnType<typeof deployFixture>>["lpToken"];
  let tokenX: Awaited<ReturnType<typeof deployFixture>>["tokenX"];
  let tokenY: Awaited<ReturnType<typeof deployFixture>>["tokenY"];

  beforeEach(async () => {
    ({ lpToken, tokenX, tokenY } = await networkHelpers.loadFixture(
      deployFixture
    ));
  });

  it("should add liquidity correctly for the first time", async function () {
    const amountX = parseUnits("100", 6);
    const amountY = parseUnits("100", 6);

    await tokenX.write.approve([lpToken.address, amountX], {
      account: owner.account,
    });
    await tokenY.write.approve([lpToken.address, amountY], {
      account: owner.account,
    });

    const addTx = lpToken.write.addLiquidity(
      [amountX, amountY, owner.account.address],
      { account: owner.account }
    );

    const expectedLp = parseUnits("100", 6);

    await viem.assertions.erc20BalancesHaveChanged(addTx, tokenX.address, [
      { address: owner.account.address, amount: -amountX },
      { address: lpToken.address, amount: amountX },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(addTx, tokenY.address, [
      { address: owner.account.address, amount: -amountY },
      { address: lpToken.address, amount: amountY },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(addTx, lpToken.address, [
      { address: owner.account.address, amount: expectedLp },
    ]);

    const balance = await lpToken.read.balanceOf([owner.account.address]);
    assert.equal(balance, expectedLp);

    const reserveX = await lpToken.read.reserveX();
    const reserveY = await lpToken.read.reserveY();
    assert.equal(reserveX, amountX);
    assert.equal(reserveY, amountY);
  });

  it("should get amount out correctly", async function () {
    const amountIn = 10_000000n;
    const reserveIn = 100_000000n;
    const reserveOut = 200_000000n;

    const amountOut = await lpToken.read.getAmoutOut([
      amountIn,
      tokenX.address,
      reserveIn,
      reserveOut,
    ]);

    const feeFactor = 997n;
    const amountInWithFee = amountIn * feeFactor;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const expectedAmountOut = numerator / denominator;

    assert.equal(amountOut, expectedAmountOut);
  });

  it("should get amount in correctly", async function () {
    const amountOut = 10_000000n;
    const reserveIn = 100_000000n;
    const reserveOut = 200_000000n;

    const amountIn = await lpToken.read.getAmoutIn([
      amountOut,
      tokenY.address,
      reserveIn,
      reserveOut,
    ]);

    const feeFactor = 997n;
    const numerator = reserveIn * amountOut * 1000n;
    const denominator = (reserveOut - amountOut) * feeFactor;
    const expectedAmountIn = numerator / denominator;

    assert.equal(amountIn, expectedAmountIn);
  });

  it("should swap exact out correctly", async function () {
    const reserveX = parseUnits("100", 6);
    const reserveY = parseUnits("200", 6);

    await tokenX.write.approve([lpToken.address, reserveX], {
      account: owner.account,
    });
    await tokenY.write.approve([lpToken.address, reserveY], {
      account: owner.account,
    });
    await lpToken.write.addLiquidity(
      [reserveX, reserveY, owner.account.address],
      { account: owner.account }
    );

    const amountOut = parseUnits("10", 6);
    const amountIn = await lpToken.read.getAmoutIn([
      amountOut,
      tokenY.address,
      reserveX,
      reserveY,
    ]);

    await tokenX.write.approve([lpToken.address, amountIn], {
      account: owner.account,
    });

    const swapTx = lpToken.write.swapExactOut(
      [tokenY.address, amountOut, receiver.account.address],
      { account: owner.account }
    );

    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenX.address, [
      { address: owner.account.address, amount: -amountIn },
      { address: lpToken.address, amount: amountIn },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(swapTx, tokenY.address, [
      { address: receiver.account.address, amount: amountOut },
      { address: lpToken.address, amount: -amountOut },
    ]);

    const balanceX = await tokenX.read.balanceOf([owner.account.address]);
    const balanceY = await tokenY.read.balanceOf([receiver.account.address]);

    assert.equal(balanceX, parseUnits("1000", 6) - reserveX - amountIn);
    assert.equal(balanceY, amountOut);
  });
});
