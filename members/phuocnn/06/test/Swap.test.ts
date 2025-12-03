import { expect } from "chai";
import { network } from "hardhat";
import { parseUnits, getAddress, decodeEventLog } from "viem";
import { describe, it } from "node:test";

describe("LPToken - Step 2: Swap Functions", function () {
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

    const amount0 = parseUnits("10", 18);
    const amount1 = parseUnits("4000", 6);

    await pepe.write.approve([factory.address, amount0], {
      account: owner.account,
    });
    await usdt.write.approve([factory.address, amount1], {
      account: owner.account,
    });

    const txHash = await factory.write.createPool(
      [pepe.address, usdt.address, amount0, amount1],
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
          poolAddress = (decodedLog.args as any).pool;
          break;
        }
      } catch (err) {
        // Ignore
      }
    }

    const pool = await viem.getContractAt("LPTokenSwap", poolAddress!);

    await pepe.write.mint([user1.account.address, parseUnits("100", 18)], {
      account: owner.account,
    });
    await usdt.write.mint([user1.account.address, parseUnits("10000", 6)], {
      account: owner.account,
    });

    return {
      factory,
      pepe,
      usdt,
      pool,
      poolAddress: poolAddress!,
      owner,
      user1,
      publicClient,
      viem,
    };
  }

  it("Should swap PEPE for USDT using buyExactIn", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amountOut = parseUnits("1", 6); // 1 USDT
    const amountInMax = parseUnits("100", 18); // Max 100 PEPE (slippage protection)

    const amountIn = await pool.read.getAmountIn([
      amountOut,
      usdt.address,
    ]);

    console.log("\n--- Buy Exact Out ---");
    console.log("Want to buy:", amountOut.toString(), "USDT");
    console.log("Need to pay:", amountIn.toString(), "PEPE");
    console.log("Max willing to pay:", amountInMax.toString(), "PEPE");
    console.log("-------------------\n");

    // Approve
    await pepe.write.approve([pool.address, amountInMax], {
      account: user1.account,
    });

    // Swap
    const txHash = await pool.write.buyExactOut(
      [amountOut, amountInMax, usdt.address, user1.account.address],
      { account: user1.account }
    );

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const user1USDTBalance = await usdt.read.balanceOf([user1.account.address]);
    const user1PEPEBalance = await pepe.read.balanceOf([user1.account.address]);

    console.log("User1 USDT balance after:", user1USDTBalance.toString());
    console.log("User1 PEPE balance after:", user1PEPEBalance.toString());

    const [newReserve0, newReserve1] = await pool.read.getReserves();
    console.log("New reserve0 (USDT):", newReserve0.toString());
    console.log("New reserve1 (PEPE):", newReserve1.toString());

    const k = await pool.read.k();
    const newK = newReserve0 * newReserve1;
    console.log("Original k:", k.toString());
    console.log("New k:", newK.toString());
    expect(Number(newK)).to.be.at.least(Number(k));
  });

  it("Should swap USDT for PEPE using buyExactIn", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amountIn = parseUnits("100", 6); // 100 USDT
    const amountOutMin = parseUnits("0.01", 18); // Min 0.01 PEPE (slippage protection)

    const amountOut = await pool.read.getAmountOut([
      amountIn,
      usdt.address, // tokenIn (USDT)
    ]);

    console.log("\n--- Buy Exact In ---");
    console.log("Paying:", amountIn.toString(), "USDT");
    console.log("Will receive:", amountOut.toString(), "PEPE");
    console.log("Min willing to receive:", amountOutMin.toString(), "PEPE");
    console.log("-------------------\n");

    // Approve
    await usdt.write.approve([pool.address, amountIn], {
      account: user1.account,
    });

    // Swap
    const txHash = await pool.write.buyExactIn(
      [amountIn, amountOutMin, usdt.address, user1.account.address],
      { account: user1.account }
    );

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const user1USDTBalance = await usdt.read.balanceOf([user1.account.address]);
    const user1PEPEBalance = await pepe.read.balanceOf([user1.account.address]);

    console.log("User1 USDT balance after:", user1USDTBalance.toString());
    console.log("User1 PEPE balance after:", user1PEPEBalance.toString());
  });

  it("Should emit Swap event", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amountIn = parseUnits("100", 6); // 100 USDT
    const amountOutMin = parseUnits("0.01", 18);

    await usdt.write.approve([pool.address, amountIn], {
      account: user1.account,
    });

    const txHash = await pool.write.buyExactIn(
      [amountIn, amountOutMin, usdt.address, user1.account.address],
      { account: user1.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let eventFound = false;
    for (const log of receipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: pool.abi,
          data: log.data,
          topics: log.topics,
        });

        if (decodedLog.eventName === "Swap") {
          eventFound = true;
          const args: any = decodedLog.args;
          console.log("\n--- Swap Event ---");
          console.log("Sender:", args.sender);
          console.log("Amount0In:", args.amount0In.toString());
          console.log("Amount1In:", args.amount1In.toString());
          console.log("Amount0Out:", args.amount0Out.toString());
          console.log("Amount1Out:", args.amount1Out.toString());
          console.log("To:", args.to);
          console.log("-----------------\n");
        }
      } catch (err) {
        // Ignore
      }
    }

    expect(eventFound).to.be.true;
  });

  it("Should revert if slippage is too high", async function () {
    const { pool, usdt, user1 } = await deployFixture();

    const amountIn = parseUnits("100", 6); // 100 USDT
    const amountOutMin = parseUnits("10", 18);

    await usdt.write.approve([pool.address, amountIn], {
      account: user1.account,
    });

    try {
      await pool.write.buyExactIn(
        [amountIn, amountOutMin, usdt.address, user1.account.address],
        { account: user1.account }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Insufficient output");
    }
  });
});

