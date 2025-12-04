import { expect } from "chai";
import { network } from "hardhat";
import { parseUnits, getAddress, decodeEventLog } from "viem";
import { describe, it } from "node:test";

describe("LPToken - Step 4: Add Liquidity", function () {
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

  it("Should add liquidity maintaining correct ratio", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amount0Desired = parseUnits("20", 18);
    const amount1Desired = parseUnits("2000", 6);
    const amount0Min = parseUnits("19", 18);
    const amount1Min = parseUnits("1900", 6);

    await pepe.write.approve([pool.address, amount0Desired], {
      account: user1.account,
    });
    await usdt.write.approve([pool.address, amount1Desired], {
      account: user1.account,
    });

    const txHash = await pool.write.addLiquidity(
      [
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        user1.account.address,
      ],
      { account: user1.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const [newReserve0, newReserve1] = await pool.read.getReserves();
    console.log("\n--- Add Liquidity ---");
    console.log("Initial reserves: 10 PEPE / 1000 USDT");
    console.log("Added: 20 PEPE / 2000 USDT");
    console.log("New reserves:", newReserve0.toString(), "PEPE /", newReserve1.toString(), "USDT");
    console.log("Expected: 30 PEPE / 3000 USDT");
    console.log("-------------------\n");

    const expectedReserve0 = parseUnits("30", 18); // 30 PEPE
    const expectedReserve1 = parseUnits("3000", 6); // 3000 USDT
    expect(newReserve0).to.equal(expectedReserve0);
    expect(newReserve1).to.equal(expectedReserve1);

    const user1LPBalance = await pool.read.balanceOf([user1.account.address]);
    console.log("User1 LP balance:", user1LPBalance.toString());
    expect(user1LPBalance).to.be.gt(0);

    const newK = await pool.read.k();
    const expectedK = expectedReserve0 * expectedReserve1;
    console.log("New k:", newK.toString());
    console.log("Expected k:", expectedK.toString());
    expect(newK).to.equal(expectedK);
  });

  it("Should emit LiquidityAdded event", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amount0Desired = parseUnits("20", 18);
    const amount1Desired = parseUnits("2000", 6);
    const amount0Min = parseUnits("19", 18);
    const amount1Min = parseUnits("1900", 6);

    await pepe.write.approve([pool.address, amount0Desired], {
      account: user1.account,
    });
    await usdt.write.approve([pool.address, amount1Desired], {
      account: user1.account,
    });

    const txHash = await pool.write.addLiquidity(
      [
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        user1.account.address,
      ],
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

        if (decodedLog.eventName === "LiquidityAdded") {
          eventFound = true;
          const args: any = decodedLog.args;
          console.log("\n--- LiquidityAdded Event ---");
          console.log("Provider:", args.provider);
          console.log("Amount0:", args.amount0.toString());
          console.log("Amount1:", args.amount1.toString());
          console.log("LP Amount:", args.lpAmount.toString());
          console.log("----------------------------\n");

          expect(getAddress(args.provider)).to.equal(getAddress(user1.account.address));
          expect(args.amount0).to.equal(parseUnits("20", 18));
          expect(args.amount1).to.equal(parseUnits("2000", 6));
        }
      } catch (err) {
        // Ignore
      }
    }

    expect(eventFound).to.be.true;
  });

  it("Should adjust amounts to maintain ratio", async function () {
    const { pool, pepe, usdt, user1, publicClient } = await deployFixture();

    const amount0Desired = parseUnits("25", 18);
    const amount1Desired = parseUnits("2000", 6);
    const amount0Min = parseUnits("19", 18);
    const amount1Min = parseUnits("1900", 6);

    await pepe.write.approve([pool.address, amount0Desired], {
      account: user1.account,
    });
    await usdt.write.approve([pool.address, amount1Desired], {
      account: user1.account,
    });

    const txHash = await pool.write.addLiquidity(
      [
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        user1.account.address,
      ],
      { account: user1.account }
    );

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const [reserve0, reserve1] = await pool.read.getReserves();
    expect(reserve0).to.equal(parseUnits("30", 18));
    expect(reserve1).to.equal(parseUnits("3000", 6));

    const user1PEPEBalance = await pepe.read.balanceOf([user1.account.address]);
    const expectedBalance = parseUnits("80", 18);
    expect(user1PEPEBalance).to.equal(expectedBalance);
  });

  it("Should revert if ratio is too far off (slippage)", async function () {
    const { pool, pepe, usdt, user1 } = await deployFixture();

    const amount0Desired = parseUnits("25", 18);
    const amount1Desired = parseUnits("2000", 6);
    const amount0Min = parseUnits("24", 18);
    const amount1Min = parseUnits("1900", 6);

    await pepe.write.approve([pool.address, amount0Desired], {
      account: user1.account,
    });
    await usdt.write.approve([pool.address, amount1Desired], {
      account: user1.account,
    });

    try {
      await pool.write.addLiquidity(
        [
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          user1.account.address,
        ],
        { account: user1.account }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("Insufficient amount0");
    }
  });
});

