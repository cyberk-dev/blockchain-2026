import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEther, parseUnits, getAddress, decodeEventLog } from "viem";
import { network } from "hardhat";
import { extractEvent } from "./utils.js";

const ONE_TOKEN = 10n ** 18n;

describe("LPToken", async function () {
  const { viem } = await network.connect();

  async function deployFixture() {
    const [owner, user, lpProvider] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    const mockToken0 = await viem.deployContract("MockToken", []);
    const mockToken1 = await viem.deployContract("MockToken", []);

    const factory = await viem.deployContract("LPFactory", []);

    const createLPTx = await factory.write.createLP([
      mockToken0.address,
      mockToken1.address,
    ]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: createLPTx,
    });

    // Extract LP address from event
    const event = decodeEventLog({
      abi: factory.abi,
      data: receipt.logs[0].data,
      topics: receipt.logs[0].topics,
    });
    const lpAddress = getAddress((event.args as any).lp);
    const lpToken = await viem.getContractAt("LPToken", lpAddress);

    // Mint tokens for testing
    await mockToken0.write.mint([owner.account.address, parseEther("1000000")]);
    await mockToken1.write.mint([owner.account.address, parseEther("1000000")]);
    await mockToken0.write.mint([user.account.address, parseEther("1000000")]);
    await mockToken1.write.mint([user.account.address, parseEther("1000000")]);
    await mockToken0.write.mint([
      lpProvider.account.address,
      parseEther("1000000"),
    ]);
    await mockToken1.write.mint([
      lpProvider.account.address,
      parseEther("1000000"),
    ]);

    const token0AsOwner = await viem.getContractAt(
      "MockToken",
      mockToken0.address,
      {
        client: { wallet: owner },
      }
    );
    const token1AsOwner = await viem.getContractAt(
      "MockToken",
      mockToken1.address,
      {
        client: { wallet: owner },
      }
    );

    await token0AsOwner.write.approve([lpAddress, parseEther("1000000")]);
    await token1AsOwner.write.approve([lpAddress, parseEther("1000000")]);

    const lpTokenAsOwner = await viem.getContractAt("LPToken", lpAddress, {
      client: { wallet: owner },
    });

    return {
      owner,
      user,
      lpProvider,
      mockToken0,
      mockToken1,
      factory,
      lpToken,
      lpTokenAsOwner,
      token0AsOwner,
      token1AsOwner,
    };
  }

  it("should set the right token0 and token1", async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, mockToken0, mockToken1 } =
      await networkHelpers.loadFixture(deployFixture);

    const token0 = await lpToken.read.token0();
    const token1 = await lpToken.read.token1();

    // token0 should be the smaller address
    assert.ok(token0 < token1, "token0 should be smaller address than token1");
  });

  it("should add initial liquidity", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner, token0AsOwner, token1AsOwner } =
      await networkHelpers.loadFixture(deployFixture);

    const amount0 = parseEther("10");
    const amount1 = parseEther("4000");

    const txPromise = lpTokenAsOwner.write.addLiquidity([amount0, amount1]);

    await viem.assertions.emit(txPromise, lpTokenAsOwner, "LiquidityAdded");

    const reserves = await lpTokenAsOwner.read.getReserves();
    assert.equal(reserves[0], amount0);
    assert.equal(reserves[1], amount1);
  });

  it("should add subsequent liquidity", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner, token0AsOwner, token1AsOwner } =
      await networkHelpers.loadFixture(deployFixture);

    // Add initial liquidity
    const amount0_1 = parseEther("10");
    const amount1_1 = parseEther("4000");
    await lpTokenAsOwner.write.addLiquidity([amount0_1, amount1_1]);

    // Add more liquidity in same ratio
    const amount0_2 = parseEther("20");
    const amount1_2 = parseEther("8000");
    await lpTokenAsOwner.write.addLiquidity([amount0_2, amount1_2]);

    const reserves = await lpTokenAsOwner.read.getReserves();
    assert.equal(reserves[0], amount0_1 + amount0_2);
    assert.equal(reserves[1], amount1_1 + amount1_2);
  });

  it("should remove liquidity", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner } = await networkHelpers.loadFixture(deployFixture);

    // Add initial liquidity
    const amount0 = parseEther("10");
    const amount1 = parseEther("4000");
    await lpTokenAsOwner.write.addLiquidity([amount0, amount1]);

    const lpBalance = await lpTokenAsOwner.read.balanceOf([
      lpTokenAsOwner.account.address,
    ]);
    const liquidityToRemove = lpBalance / 2n;

    const txPromise = lpTokenAsOwner.write.removeLiquidity([liquidityToRemove]);

    await viem.assertions.emit(txPromise, lpTokenAsOwner, "LiquidityRemoved");

    const reserves = await lpTokenAsOwner.read.getReserves();
    assert.ok(reserves[0] < amount0);
    assert.ok(reserves[1] < amount1);
  });

  it("should swap exact in (buy)", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner, token1AsOwner } = await networkHelpers.loadFixture(
      deployFixture
    );

    // Add initial liquidity
    await lpTokenAsOwner.write.addLiquidity([
      parseEther("10"),
      parseEther("4000"),
    ]);

    // Approve token1 for swap
    await token1AsOwner.write.approve([
      lpTokenAsOwner.address,
      parseEther("1000"),
    ]);

    const amountIn = parseEther("100");
    const minAmountOut = 0n;

    const txPromise = lpTokenAsOwner.write.swapExactIn([
      amountIn,
      true, // isBuy
      minAmountOut,
    ]);

    await viem.assertions.emit(txPromise, lpTokenAsOwner, "Swap");
  });

  it("should swap exact in (sell)", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner, token0AsOwner } = await networkHelpers.loadFixture(
      deployFixture
    );

    // Add initial liquidity
    await lpTokenAsOwner.write.addLiquidity([
      parseEther("10"),
      parseEther("4000"),
    ]);

    // Approve token0 for swap
    await token0AsOwner.write.approve([
      lpTokenAsOwner.address,
      parseEther("10"),
    ]);

    const amountIn = parseEther("1");
    const minAmountOut = 0n;

    const txPromise = lpTokenAsOwner.write.swapExactIn([
      amountIn,
      false, // isBuy (false = sell)
      minAmountOut,
    ]);

    await viem.assertions.emit(txPromise, lpTokenAsOwner, "Swap");
  });

  it("should revert with InsufficientLiquidity when amount is 0", async function () {
    const { networkHelpers } = await network.connect();
    const { lpTokenAsOwner } = await networkHelpers.loadFixture(deployFixture);

    await assert.rejects(
      async () => await lpTokenAsOwner.write.addLiquidity([0n, 0n]),
      /InsufficientLiquidity/
    );
  });
});
