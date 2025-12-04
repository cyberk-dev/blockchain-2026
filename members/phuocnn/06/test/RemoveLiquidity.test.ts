import { expect } from "chai";
import { network } from "hardhat";
import { parseUnits, getAddress, decodeEventLog } from "viem";
import { describe, it } from "node:test";

describe("LPToken - Step 5: Remove Liquidity", function () {
  async function deployFixture() {
    const { viem } = await network.connect();
    const [owner, user1] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const factory = await viem.deployContract("LPFactory");

    const pepe = await viem.deployContract("MockERC20", [
      "Pepe Token",
      "PEPE",
      parseUnits("1000000", 18),
    ]);

    const usdt = await viem.deployContract("MockERC20", [
      "Tether USD",
      "USDT",
      parseUnits("10000000", 6),
    ]);

    const initialAmount0 = parseUnits("10", 18);
    const initialAmount1 = parseUnits("1000", 6);

    await pepe.write.approve([factory.address, initialAmount0], {
      account: owner.account,
    });
    await usdt.write.approve([factory.address, initialAmount1], {
      account: owner.account,
    });

    const txHash = await factory.write.createPool(
      [pepe.address, usdt.address, initialAmount0, initialAmount1],
      { account: owner.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let poolAddress: `0x${string}` | null = null;
    for (const log of receipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: factory.abi,
          data: log.data,
          topics: log.topics,
        });
        if (decodedLog.eventName === "PoolCreated") {
          poolAddress = (decodedLog.args as any).pool as `0x${string}`;
          break;
        }
      } catch (e) {
        // Ignore
      }
    }

    if (!poolAddress) {
      throw new Error("Pool not created");
    }

    const pool = await viem.getContractAt("LPTokenSwap", poolAddress);

    await pepe.write.mint([user1.account.address, parseUnits("100", 18)], {
      account: owner.account,
    });
    await usdt.write.mint([user1.account.address, parseUnits("10000", 6)], {
      account: owner.account,
    });

    const addAmount0 = parseUnits("20", 18);
    const addAmount1 = parseUnits("2000", 6);

    await pepe.write.approve([poolAddress, addAmount0], {
      account: user1.account,
    });
    await usdt.write.approve([poolAddress, addAmount1], {
      account: user1.account,
    });

    await pool.write.addLiquidity(
      [addAmount0, addAmount1, 0n, 0n, user1.account.address],
      { account: user1.account }
    );

    return {
      viem,
      owner,
      user1,
      publicClient,
      factory,
      pepe,
      usdt,
      pool,
      poolAddress,
    };
  }

  it("Should remove liquidity successfully", async function () {
    const { pool, user1, publicClient, pepe, usdt } = await deployFixture();

    const lpBalance = await pool.read.balanceOf([user1.account.address]);
    expect(Number(lpBalance)).to.be.gt(0);

    const [reserve0Before, reserve1Before] = await pool.read.getReserves();
    const totalSupplyBefore = await pool.read.totalSupply();

    const removeAmount = lpBalance / 2n;

    const expectedAmount0 = (removeAmount * reserve0Before) / totalSupplyBefore;
    const expectedAmount1 = (removeAmount * reserve1Before) / totalSupplyBefore;

    await pool.write.approve([pool.address, removeAmount], {
      account: user1.account,
    });

    const pepeBalanceBefore = await pepe.read.balanceOf([user1.account.address]);
    const usdtBalanceBefore = await usdt.read.balanceOf([user1.account.address]);

    const txHash = await pool.write.removeLiquidity(
      [removeAmount, 0n, 0n, user1.account.address],
      { account: user1.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let liquidityRemovedEvent = null;
    for (const log of receipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: pool.abi,
          data: log.data,
          topics: log.topics,
        });
        if (decodedLog.eventName === "LiquidityRemoved") {
          liquidityRemovedEvent = decodedLog.args;
          break;
        }
      } catch (e) {
        // Ignore
      }
    }

    expect(liquidityRemovedEvent).to.not.be.null;
    expect((liquidityRemovedEvent as any).provider).to.equal(
      getAddress(user1.account.address)
    );
    expect((liquidityRemovedEvent as any).lpAmount).to.equal(removeAmount);

    const pepeBalanceAfter = await pepe.read.balanceOf([user1.account.address]);
    const usdtBalanceAfter = await usdt.read.balanceOf([user1.account.address]);

    expect(pepeBalanceAfter - pepeBalanceBefore).to.equal(expectedAmount0);
    expect(usdtBalanceAfter - usdtBalanceBefore).to.equal(expectedAmount1);

    const [reserve0After, reserve1After] = await pool.read.getReserves();
    expect(reserve0After).to.equal(reserve0Before - expectedAmount0);
    expect(reserve1After).to.equal(reserve1Before - expectedAmount1);

    const lpBalanceAfter = await pool.read.balanceOf([user1.account.address]);
    expect(lpBalanceAfter).to.equal(lpBalance - removeAmount);
  });

  it("Should revert if liquidity is zero", async function () {
    const { pool, user1 } = await deployFixture();

    try {
      await pool.write.removeLiquidity([0n, 0n, 0n, user1.account.address], {
        account: user1.account,
      });
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Insufficient liquidity");
    }
  });

  it("Should revert if amount0Min is not met", async function () {
    const { pool, user1 } = await deployFixture();

    const lpBalance = await pool.read.balanceOf([user1.account.address]);
    const [reserve0, reserve1] = await pool.read.getReserves();
    const totalSupply = await pool.read.totalSupply();

    const removeAmount = lpBalance / 2n;
    const expectedAmount0 = (removeAmount * reserve0) / totalSupply;
    const amount0MinTooHigh = expectedAmount0 + 1n;

    await pool.write.approve([pool.address, removeAmount], {
      account: user1.account,
    });

    try {
      await pool.write.removeLiquidity(
        [removeAmount, amount0MinTooHigh, 0n, user1.account.address],
        { account: user1.account }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Insufficient amount0");
    }
  });

  it("Should revert if amount1Min is not met", async function () {
    const { pool, user1 } = await deployFixture();

    const lpBalance = await pool.read.balanceOf([user1.account.address]);
    const [reserve0, reserve1] = await pool.read.getReserves();
    const totalSupply = await pool.read.totalSupply();

    const removeAmount = lpBalance / 2n;
    const expectedAmount1 = (removeAmount * reserve1) / totalSupply;
    const amount1MinTooHigh = expectedAmount1 + 1n;

    await pool.write.approve([pool.address, removeAmount], {
      account: user1.account,
    });

    try {
      await pool.write.removeLiquidity(
        [removeAmount, 0n, amount1MinTooHigh, user1.account.address],
        { account: user1.account }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Insufficient amount1");
    }
  });

  it("Should remove all liquidity", async function () {
    const { pool, user1, publicClient, pepe, usdt } = await deployFixture();

    const lpBalance = await pool.read.balanceOf([user1.account.address]);
    const [reserve0, reserve1] = await pool.read.getReserves();
    const totalSupply = await pool.read.totalSupply();

    const expectedAmount0 = (lpBalance * reserve0) / totalSupply;
    const expectedAmount1 = (lpBalance * reserve1) / totalSupply;

    await pool.write.approve([pool.address, lpBalance], {
      account: user1.account,
    });

    const pepeBalanceBefore = await pepe.read.balanceOf([user1.account.address]);
    const usdtBalanceBefore = await usdt.read.balanceOf([user1.account.address]);

    await pool.write.removeLiquidity(
      [lpBalance, 0n, 0n, user1.account.address],
      { account: user1.account }
    );

    const pepeBalanceAfter = await pepe.read.balanceOf([user1.account.address]);
    const usdtBalanceAfter = await usdt.read.balanceOf([user1.account.address]);

    expect(pepeBalanceAfter - pepeBalanceBefore).to.equal(expectedAmount0);
    expect(usdtBalanceAfter - usdtBalanceBefore).to.equal(expectedAmount1);

    const lpBalanceAfter = await pool.read.balanceOf([user1.account.address]);
    expect(lpBalanceAfter).to.equal(0n);
  });

  it("Should update k correctly after removing liquidity", async function () {
    const { pool, user1 } = await deployFixture();

    const lpBalance = await pool.read.balanceOf([user1.account.address]);
    const removeAmount = lpBalance / 2n;

    const [reserve0Before, reserve1Before] = await pool.read.getReserves();
    const kBefore = reserve0Before * reserve1Before;

    await pool.write.approve([pool.address, removeAmount], {
      account: user1.account,
    });

    await pool.write.removeLiquidity(
      [removeAmount, 0n, 0n, user1.account.address],
      { account: user1.account }
    );

    const [reserve0After, reserve1After] = await pool.read.getReserves();
    const kAfter = reserve0After * reserve1After;

    expect(Number(kAfter)).to.be.lt(Number(kBefore));
    expect(kAfter).to.equal(reserve0After * reserve1After);
  });
});

