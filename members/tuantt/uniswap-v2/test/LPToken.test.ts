import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";
import { getAddress, parseEther } from "viem";
import { getEventArgs, mulDiv, mulDivRoundingUp } from "./utils.js";

const FEE_DENOMINATOR = 1000n;
const FEE_NUMERATOR = 970n; // 3%

function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) throw new Error("sqrt of negative");
  if (value < 2n) return value;

  let x0 = value;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + value / x1) >> 1n;
  }
  return x0;
}

function amountOutExactIn(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn <= 0n) return 0n;
  if (reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = (amountIn * FEE_NUMERATOR) / FEE_DENOMINATOR;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  return denominator === 0n ? 0n : numerator / denominator;
}

function amountInExactOut(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountOut <= 0n) return 0n;
  if (reserveIn <= 0n || reserveOut <= 0n) return 0n;
  if (amountOut >= reserveOut) return 0n;
  const numerator = reserveIn * amountOut;
  const denominator = (reserveOut - amountOut) * FEE_NUMERATOR;
  return mulDivRoundingUp(numerator, FEE_DENOMINATOR, denominator);
}

describe("LPToken", async function () {
  const { ignition, viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, feeRecipient] = await viem.getWalletClients();
  const TOKEN_CREATION_FEE = parseEther("0.01");

  async function deployAndCreatePair() {
    const { factory, tokenA, tokenB } = await ignition.deploy(
      TokenFactoryWithBeaconModule,
      {
        parameters: {
          TokenFactoryWithBeaconModule: {
            name: "Token A",
            symbol: "TKNA",
            nameB: "Token B",
            symbolB: "TKNB",
            feeRecipient: feeRecipient.account.address,
          },
        },
      }
    );

    const createTxHash = await factory.write.createToken(
      [tokenA.address, tokenB.address],
      { value: TOKEN_CREATION_FEE }
    );

    const pairAddress = await getEventArgs(
      factory,
      "TokenCreated",
      publicClient,
      createTxHash,
      "tokenAddress"
    );

    const lp = await viem.getContractAt("LPToken", pairAddress);

    const [t0Addr, t1Addr] = await Promise.all([
      lp.read.token0(),
      lp.read.token1(),
    ]);
    const token0 = await viem.getContractAt("Token", t0Addr);
    const token1 = await viem.getContractAt("Token", t1Addr);

    return {
      factory,
      tokenA,
      tokenB,
      lp,
      token0,
      token1,
      t0Addr,
      t1Addr,
      pairAddress,
    };
  }

  it("should deploy LPToken pair via factory", async function () {
    const { factory, tokenA, tokenB } = await ignition.deploy(
      TokenFactoryWithBeaconModule,
      {
        parameters: {
          TokenFactoryWithBeaconModule: {
            name: "Token A",
            symbol: "TKNA",
            nameB: "Token B",
            symbolB: "TKNB",
            feeRecipient: feeRecipient.account.address,
          },
        },
      }
    );

    const createTx = factory.write.createToken(
      [tokenA.address, tokenB.address],
      {
        value: TOKEN_CREATION_FEE, // token creation fee
      }
    );
    // verify balances changed
    await viem.assertions.balancesHaveChanged(createTx, [
      {
        address: feeRecipient.account.address,
        amount: TOKEN_CREATION_FEE,
      },
      {
        address: deployer.account.address,
        amount: -TOKEN_CREATION_FEE,
      },
    ]);

    const createTxHash = await createTx;

    // get the created token address from event
    const tokenAddress = await getEventArgs(
      factory,
      "TokenCreated",
      publicClient,
      createTxHash,
      "tokenAddress"
    );

    const lp = await viem.getContractAt("LPToken", tokenAddress);
    const [lpToken0, lpToken1] = await Promise.all([
      lp.read.token0(),
      lp.read.token1(),
    ]);

    const a = BigInt(tokenA.address);
    const b = BigInt(tokenB.address);
    const expected0 = a < b ? tokenA.address : tokenB.address;
    const expected1 = a < b ? tokenB.address : tokenA.address;

    assert.equal(lpToken0, getAddress(expected0), "token0 should be sorted");
    assert.equal(lpToken1, getAddress(expected1), "token1 should be sorted");
  });

  it("LPToken.addLiquidity should mint LP and update reserves", async function () {
    const { lp, token0, token1, pairAddress } = await deployAndCreatePair();

    const amount0 = 1_000n * 10n ** 18n;
    const amount1 = 2_000n * 10n ** 18n;

    const expectedLpMinted = sqrtBigInt(amount0 * amount1);

    await token0.write.approve([pairAddress, amount0], {
      account: deployer.account,
    });
    await token1.write.approve([pairAddress, amount1], {
      account: deployer.account,
    });

    const txHash = lp.write.addLiquidity(
      [amount0, amount1, deployer.account.address],
      { account: deployer.account }
    );

    await viem.assertions.erc20BalancesHaveChanged(txHash, token0, [
      { address: deployer.account.address, amount: -amount0 },
      { address: pairAddress, amount: amount0 },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(txHash, token1, [
      { address: deployer.account.address, amount: -amount1 },
      { address: pairAddress, amount: amount1 },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(txHash, lp, [
      { address: deployer.account.address, amount: expectedLpMinted },
    ]);

    const confirmed = await txHash;
    await publicClient.waitForTransactionReceipt({ hash: confirmed });

    const [reserve0, reserve1, supply, lpBal] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
      lp.read.totalSupply(),
      lp.read.balanceOf([deployer.account.address]),
    ]);

    assert.equal(reserve0, amount0);
    assert.equal(reserve1, amount1);
    assert.ok(supply > 0n);
    assert.equal(lpBal, supply);
  });

  it("LPToken.swapExactIn should swap and update reserves", async function () {
    const { lp, token0, token1, pairAddress } = await deployAndCreatePair();

    const seed0 = 1_000n * 10n ** 18n;
    const seed1 = 1_000n * 10n ** 18n;
    await token0.write.approve([pairAddress, seed0], {
      account: deployer.account,
    });
    await token1.write.approve([pairAddress, seed1], {
      account: deployer.account,
    });
    await publicClient.waitForTransactionReceipt({
      hash: await lp.write.addLiquidity(
        [seed0, seed1, deployer.account.address],
        {
          account: deployer.account,
        }
      ),
    });

    const amountIn = 10n * 10n ** 18n;
    const [r0Before, r1Before] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
    ]);
    const expectedOut = amountOutExactIn(amountIn, r0Before, r1Before);
    assert.ok(expectedOut > 0n);

    await token0.write.approve([pairAddress, amountIn], {
      account: deployer.account,
    });

    const swapTx = lp.write.swapExactIn(
      [await lp.read.token0(), amountIn, 0n],
      {
        account: deployer.account,
      }
    );

    await viem.assertions.erc20BalancesHaveChanged(swapTx, token0, [
      { address: deployer.account.address, amount: -amountIn },
      { address: pairAddress, amount: amountIn },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(swapTx, token1, [
      { address: deployer.account.address, amount: expectedOut },
      { address: pairAddress, amount: -expectedOut },
    ]);

    const confirmed = await swapTx;
    await publicClient.waitForTransactionReceipt({ hash: confirmed });

    const [r0After, r1After] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
    ]);
    assert.equal(r0After, r0Before + amountIn);
    assert.equal(r1After, r1Before - expectedOut);
  });

  it("LPToken.swapExactOut should take expected input and update reserves", async function () {
    const { lp, token0, token1, pairAddress } = await deployAndCreatePair();

    const seed0 = 1_000n * 10n ** 18n;
    const seed1 = 1_000n * 10n ** 18n;
    await token0.write.approve([pairAddress, seed0], {
      account: deployer.account,
    });
    await token1.write.approve([pairAddress, seed1], {
      account: deployer.account,
    });
    await publicClient.waitForTransactionReceipt({
      hash: await lp.write.addLiquidity(
        [seed0, seed1, deployer.account.address],
        {
          account: deployer.account,
        }
      ),
    });

    const amountOut = 5n * 10n ** 18n;
    const [r0Before, r1Before] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
    ]);
    const expectedIn = amountInExactOut(amountOut, r0Before, r1Before);
    assert.ok(expectedIn > 0n);

    await token0.write.approve([pairAddress, expectedIn], {
      account: deployer.account,
    });

    const txHash = lp.write.swapExactOut(
      [await lp.read.token0(), amountOut, expectedIn],
      {
        account: deployer.account,
      }
    );

    await viem.assertions.erc20BalancesHaveChanged(txHash, token0, [
      { address: deployer.account.address, amount: -expectedIn },
      { address: pairAddress, amount: expectedIn },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(txHash, token1, [
      { address: deployer.account.address, amount: amountOut },
      { address: pairAddress, amount: -amountOut },
    ]);

    const confirmed = await txHash;
    await publicClient.waitForTransactionReceipt({ hash: confirmed });

    const [r0After, r1After] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
    ]);
    assert.equal(r0After, r0Before + expectedIn);
    assert.equal(r1After, r1Before - amountOut);
  });

  it("LPToken.removeLiquidity should burn LP and return tokens", async function () {
    const { lp, token0, token1, pairAddress } = await deployAndCreatePair();

    const amount0 = 1_000n * 10n ** 18n;
    const amount1 = 1_000n * 10n ** 18n;
    await token0.write.approve([pairAddress, amount0], {
      account: deployer.account,
    });
    await token1.write.approve([pairAddress, amount1], {
      account: deployer.account,
    });
    await publicClient.waitForTransactionReceipt({
      hash: await lp.write.addLiquidity(
        [amount0, amount1, deployer.account.address],
        {
          account: deployer.account,
        }
      ),
    });

    const lpBal = await lp.read.balanceOf([deployer.account.address]);
    const burn = lpBal / 2n;
    assert.ok(burn > 0n);

    const [r0Before, r1Before, supplyBefore] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
      lp.read.totalSupply(),
    ]);

    const expected0Out = mulDiv(burn, r0Before, supplyBefore);
    const expected1Out = mulDiv(burn, r1Before, supplyBefore);

    const txHash = lp.write.removeLiquidity(
      [burn, 0n, 0n, deployer.account.address],
      {
        account: deployer.account,
      }
    );

    await viem.assertions.erc20BalancesHaveChanged(txHash, lp, [
      { address: deployer.account.address, amount: -burn },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(txHash, token0, [
      { address: deployer.account.address, amount: expected0Out },
      { address: pairAddress, amount: -expected0Out },
    ]);
    await viem.assertions.erc20BalancesHaveChanged(txHash, token1, [
      { address: deployer.account.address, amount: expected1Out },
      { address: pairAddress, amount: -expected1Out },
    ]);

    const confirmed = await txHash;
    await publicClient.waitForTransactionReceipt({ hash: confirmed });

    const [r0After, r1After] = await Promise.all([
      lp.read.reserve0(),
      lp.read.reserve1(),
    ]);
    assert.ok(r0After < r0Before);
    assert.ok(r1After < r1Before);
  });
});
