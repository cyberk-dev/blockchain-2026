import { expect } from "chai";
import { network } from "hardhat";
import { parseUnits, getAddress, decodeEventLog } from "viem";
import { describe, it } from "node:test";

describe("LPToken - Step 1: Create Pool", function () {
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

    return {
      factory,
      pepe,
      usdt,
      owner,
      user1,
      publicClient,
      viem,
    };
  }

  it("Should create pool with initial liquidity", async function () {
    const { factory, pepe, usdt, owner, publicClient, viem } = await deployFixture();

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
          const args: any = decodedLog.args;
          poolAddress = args.pool;
          console.log("\n--- Pool Created ---");
          console.log("Token0:", args.token0);
          console.log("Token1:", args.token1);
          console.log("Pool Address:", args.pool);
          console.log("Amount0:", args.amount0.toString());
          console.log("Amount1:", args.amount1.toString());
          console.log("-------------------\n");
        }
      } catch (err) {
        // Ignore
      }
    }

    expect(poolAddress).to.not.be.null;

    const pool = await viem.getContractAt("LPTokenSwap", poolAddress!);

    const token0 = await pool.read.token0();
    const token1 = await pool.read.token1();
    expect(getAddress(token0)).to.equal(getAddress(pepe.address));
    expect(getAddress(token1)).to.equal(getAddress(usdt.address));

    const [reserve0, reserve1] = await pool.read.getReserves();
    expect(reserve0).to.equal(amount0);
    expect(reserve1).to.equal(amount1);

    const k = await pool.read.k();
    const expectedK = amount0 * amount1;
    expect(k).to.equal(expectedK);
    console.log("Constant k:", k.toString());
    console.log("Expected k (10 PEPE * 4000 USDT):", expectedK.toString());

    const expectedLPAmount = amount0 > amount1 ? amount0 : amount1;
    const ownerLPBalance = await pool.read.balanceOf([owner.account.address]);
    expect(ownerLPBalance).to.equal(expectedLPAmount);
    console.log("LP Token minted:", ownerLPBalance.toString());
    console.log("Expected LP (Max):", expectedLPAmount.toString());

    const totalSupply = await pool.read.totalSupply();
    expect(totalSupply).to.equal(expectedLPAmount);

    const pepeBalance = await pepe.read.balanceOf([poolAddress!]);
    const usdtBalance = await usdt.read.balanceOf([poolAddress!]);
    expect(pepeBalance).to.equal(amount0);
    expect(usdtBalance).to.equal(amount1);
    console.log("Pool PEPE balance:", pepeBalance.toString());
    console.log("Pool USDT balance:", usdtBalance.toString());
  });

  it("Should emit LiquidityAdded event", async function () {
    const { factory, pepe, usdt, owner, publicClient, viem } = await deployFixture();

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

    expect(poolAddress).to.not.be.null;

    const pool = await viem.getContractAt("LPTokenSwap", poolAddress!);
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

          expect(getAddress(args.provider)).to.equal(getAddress(owner.account.address));
          expect(args.amount0).to.equal(amount0);
          expect(args.amount1).to.equal(amount1);
        }
      } catch (err) {
        // Ignore
      }
    }

    expect(eventFound).to.be.true;
  });

  it("Should revert if pool already exists", async function () {
    const { factory, pepe, usdt, owner } = await deployFixture();

    const amount0 = parseUnits("10", 18);
    const amount1 = parseUnits("4000", 6);

    await pepe.write.approve([factory.address, amount0], {
      account: owner.account,
    });
    await usdt.write.approve([factory.address, amount1], {
      account: owner.account,
    });

    await factory.write.createPool(
      [pepe.address, usdt.address, amount0, amount1],
      { account: owner.account }
    );

    try {
      await factory.write.createPool(
        [pepe.address, usdt.address, amount0, amount1],
        { account: owner.account }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("LPFactory: Pool already exists");
    }
  });

  it("Should revert if initialize is called twice", async function () {
    const { factory, pepe, usdt, owner, publicClient, viem } = await deployFixture();

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

    try {
      await pool.write.initialize(
        [pepe.address, usdt.address, amount0, amount1, owner.account.address],
        { account: factory.address }
      );
      expect.fail("Should have reverted");
    } catch (error: any) {
      expect(error.message).to.include("LPToken: Already initialized");
    }
  });
});

