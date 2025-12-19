import { network } from 'hardhat';
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { getAddress, parseUnits } from 'viem';

async function deploy() {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner] = await viem.getWalletClients();

  const PEPE = await viem.deployContract('MockToken', [
    'PEPE',
    'PEPE',
    parseUnits('1000000', 18),
  ]);
  const USDT = await viem.deployContract('MockToken', [
    'USDT',
    'USDT',
    parseUnits('1000000', 18),
  ]);

  const lpToken = await viem.deployContract('LPToken', [
    PEPE.address,
    USDT.address,
  ]);

  return { owner, lpToken, PEPE, USDT, viem };
}

describe('LpToken', async function () {
  it('Should deploy LPToken contract', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    const tokenA = await lpToken.read.tokenX();
    const tokenB = await lpToken.read.tokenY();

    assert.equal(getAddress(tokenA), getAddress(PEPE.address));
    assert.equal(getAddress(tokenB), getAddress(USDT.address));
  });

  it('Add liquidity', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    const addLiquidityTask = lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      addLiquidityTask,
      USDT.address,
      [
        { address: owner.account.address, amount: -parseUnits('1000', 18) },
        { address: lpToken.address, amount: parseUnits('1000', 18) },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      addLiquidityTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: -parseUnits('2000', 18) },
        { address: lpToken.address, amount: parseUnits('2000', 18) },
      ]
    );

    // Get Max for the first time add
    // Should be 2000
    await viem.assertions.erc20BalancesHaveChanged(
      addLiquidityTask,
      lpToken.address,
      [{ address: owner.account.address, amount: parseUnits('2000', 18) }]
    );
  });

  it('Remove liquidity', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const removeLiquidityTask = lpToken.write.removeLiquidity([
      parseUnits('2000', 18),
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      removeLiquidityTask,
      lpToken.address,
      [{ address: owner.account.address, amount: -parseUnits('2000', 18) }]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      removeLiquidityTask,
      USDT.address,
      [
        { address: owner.account.address, amount: parseUnits('1000', 18) },
        { address: lpToken.address, amount: -parseUnits('1000', 18) },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      removeLiquidityTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: parseUnits('2000', 18) },
        { address: lpToken.address, amount: -parseUnits('2000', 18) },
      ]
    );
  });

  it('SwapExactIn', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const reserveIn = await lpToken.read.reserveX();
    const reserveOut = await lpToken.read.reserveY();

    const amountInWithFee = 1000n;
    const amountInWithoutFee = (amountInWithFee * 997n) / 1000n;
    const expectedAmountOut =
      (amountInWithoutFee * reserveOut) / (reserveIn + amountInWithoutFee);

    console.log('expectedAmountOut', expectedAmountOut);

    await PEPE.write.approve([lpToken.address, amountInWithFee]);

    const swapExactInTask = lpToken.write.swapExactIn([
      PEPE.address,
      amountInWithFee,
      0n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactInTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: -amountInWithFee },
        { address: lpToken.address, amount: amountInWithFee },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactInTask,
      USDT.address,
      [
        { address: owner.account.address, amount: expectedAmountOut },
        { address: lpToken.address, amount: -expectedAmountOut },
      ]
    );
  });

  it('SwapExactOut', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const reserveIn = await lpToken.read.reserveX();
    const reserveOut = await lpToken.read.reserveY();

    const amountOut = 100n;
    const expectedAmountIn = roundingUp(
      reserveIn * amountOut * 1000n,
      997n * (reserveOut - amountOut)
    );

    await PEPE.write.approve([lpToken.address, expectedAmountIn]);
    console.log('expectedAmountIn', expectedAmountIn);

    const swapExactOutTask = lpToken.write.swapExactOut([
      PEPE.address,
      amountOut,
      100000000000n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactOutTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: -expectedAmountIn },
        { address: lpToken.address, amount: expectedAmountIn },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactOutTask,
      USDT.address,
      [
        { address: owner.account.address, amount: amountOut },
        { address: lpToken.address, amount: -amountOut },
      ]
    );
  });

  it('Add liquidity with zero amount0 should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await assert.rejects(
      lpToken.write.addLiquidity([0n, parseUnits('1000', 18)]),
      /InvalidInput/
    );
  });

  it('Add liquidity with zero amount1 should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await assert.rejects(
      lpToken.write.addLiquidity([parseUnits('2000', 18), 0n]),
      /InvalidInput/
    );
  });

  it('Add liquidity with wrong ratio should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('4000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('2000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await assert.rejects(
      lpToken.write.addLiquidity([
        parseUnits('2000', 18),
        parseUnits('500', 18), // Wrong ratio
      ]),
      /InvalidRatio/
    );
  });

  it('SwapExactIn with zero amountIn should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await assert.rejects(
      lpToken.write.swapExactIn([PEPE.address, 0n, 0n]),
      /InvalidInput/
    );
  });

  it('SwapExactIn with invalid token should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, viem } = await networkHelpers.loadFixture(
      deploy
    );

    const invalidToken = await viem.deployContract('MockToken', [
      'INVALID',
      'INVALID',
      parseUnits('1000', 18),
    ]);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await assert.rejects(
      lpToken.write.swapExactIn([
        invalidToken.address,
        parseUnits('100', 18),
        0n,
      ]),
      /InvalidToken/
    );
  });

  it('SwapExactIn with slippage exceeded should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const amountIn = parseUnits('100', 18);
    const minAmountOut = parseUnits('1000', 18); // Unrealistically high

    await assert.rejects(
      lpToken.write.swapExactIn([PEPE.address, amountIn, minAmountOut]),
      /SlippageExceeded/
    );
  });

  it('SwapExactIn with tokenY', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const reserveIn = await lpToken.read.reserveY();
    const reserveOut = await lpToken.read.reserveX();

    const amountInWithFee = 500n;
    const amountInWithoutFee = (amountInWithFee * 997n) / 1000n;
    const expectedAmountOut =
      (amountInWithoutFee * reserveOut) / (reserveIn + amountInWithoutFee);

    await USDT.write.approve([lpToken.address, amountInWithFee]);

    const swapExactInTask = lpToken.write.swapExactIn([
      USDT.address,
      amountInWithFee,
      0n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactInTask,
      USDT.address,
      [
        { address: owner.account.address, amount: -amountInWithFee },
        { address: lpToken.address, amount: amountInWithFee },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactInTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: expectedAmountOut },
        { address: lpToken.address, amount: -expectedAmountOut },
      ]
    );
  });

  it('SwapExactOut with zero amountOut should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await assert.rejects(
      lpToken.write.swapExactOut([PEPE.address, 0n, parseUnits('1000', 18)]),
      /InvalidOutput/
    );
  });

  it('SwapExactOut with invalid token should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, viem } = await networkHelpers.loadFixture(
      deploy
    );

    const invalidToken = await viem.deployContract('MockToken', [
      'INVALID',
      'INVALID',
      parseUnits('1000', 18),
    ]);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    await assert.rejects(
      lpToken.write.swapExactOut([
        invalidToken.address,
        parseUnits('100', 18),
        parseUnits('1000', 18),
      ]),
      /InvalidToken/
    );
  });

  it('SwapExactOut with slippage exceeded should revert', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT } = await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const amountOut = parseUnits('100', 18);
    const maxAmountIn = 1n; // Unrealistically low

    await assert.rejects(
      lpToken.write.swapExactOut([PEPE.address, amountOut, maxAmountIn]),
      /SlippageExceeded/
    );
  });

  it('SwapExactOut with tokenY', async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken, PEPE, USDT, owner, viem } =
      await networkHelpers.loadFixture(deploy);

    await PEPE.write.approve([lpToken.address, parseUnits('2000', 18)]);
    await USDT.write.approve([lpToken.address, parseUnits('1000', 18)]);

    await lpToken.write.addLiquidity([
      parseUnits('2000', 18),
      parseUnits('1000', 18),
    ]);

    const reserveIn = await lpToken.read.reserveY();
    const reserveOut = await lpToken.read.reserveX();

    const amountOut = 50n;
    const expectedAmountIn = roundingUp(
      reserveIn * amountOut * 1000n,
      997n * (reserveOut - amountOut)
    );

    await USDT.write.approve([lpToken.address, expectedAmountIn]);

    const swapExactOutTask = lpToken.write.swapExactOut([
      USDT.address,
      amountOut,
      100000000000n,
    ]);

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactOutTask,
      USDT.address,
      [
        { address: owner.account.address, amount: -expectedAmountIn },
        { address: lpToken.address, amount: expectedAmountIn },
      ]
    );

    await viem.assertions.erc20BalancesHaveChanged(
      swapExactOutTask,
      PEPE.address,
      [
        { address: owner.account.address, amount: amountOut },
        { address: lpToken.address, amount: -amountOut },
      ]
    );
  });
});

function roundingUp(a: bigint, b: bigint) {
  const result = a / b;
  if (result * b === a) return result;
  return result + 1n;
}
