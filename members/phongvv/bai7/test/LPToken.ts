import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import { lpTokenFixture, LpTokenFixtureType } from "./fixture.js";
import { parseUnits } from "viem";
import { network } from "hardhat";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(this: NetworkConnection) {
  return await lpTokenFixture(this);
}

describe("LPToken", async function () {
  let fixture: LpTokenFixtureType;

  beforeEach(async function () {
    const connection = await network.connect();
    fixture = await connection.networkHelpers.loadFixture(
      deploy.bind(connection)
    );
  });

  describe("Deployment", () => {
    it("should deploy with correct token addresses", async () => {
      const { lpToken, token1, token2 } = fixture;

      const lpToken1 = await lpToken.read.token1();
      const lpToken2 = await lpToken.read.token2();

      assert.strictEqual(
        lpToken1.toLowerCase(),
        token1.address.toLowerCase(),
        "Token1 address mismatch"
      );
      assert.strictEqual(
        lpToken2.toLowerCase(),
        token2.address.toLowerCase(),
        "Token2 address mismatch"
      );
    });

    it("should have correct name and symbol", async () => {
      const { lpToken } = fixture;

      const name = await lpToken.read.name();
      const symbol = await lpToken.read.symbol();

      assert.strictEqual(name, "LP Token", "Name mismatch");
      assert.strictEqual(symbol, "LP", "Symbol mismatch");
    });
  });

  describe("Add Liquidity", () => {
    it("should add initial liquidity successfully", async () => {
      const { lpToken, token1, token2, users } = fixture;

      const amount1 = parseUnits("100", 18);
      const amount2 = parseUnits("200", 18);

      // Approve tokens
      await token1.write.approve([lpToken.address, amount1]);
      await token2.write.approve([lpToken.address, amount2]);

      // Add liquidity
      await lpToken.write.addLiquidity([amount1, amount2, amount1, amount2]);

      // Check LP token balance
      const lpBalance = await lpToken.read.balanceOf([
        users.deployer.account.address,
      ]);
      assert.equal(lpBalance, amount2);
    });
  });

  describe("Add Liquidity: Second add", () => {
    beforeEach(async function () {
      const { lpToken, token1, token2, users } = fixture;

      // First liquidity provider
      const amount1First = parseUnits("100", 18);
      const amount2First = parseUnits("200", 18);

      await token1.write.approve([lpToken.address, amount1First]);
      await token2.write.approve([lpToken.address, amount2First]);

      await lpToken.write.addLiquidity([
        amount1First,
        amount2First,
        amount1First,
        amount2First,
      ]);
    });

    it("should add liquidity with correct proportions", async () => {
      const { lpToken, token1, token2, users } = fixture;
      // Second liquidity provider (user1)
      const amount1Second = parseUnits("50", 18);
      const amount2Second = parseUnits("100", 18);

      await token1.write.approve([lpToken.address, amount1Second], {
        account: users.user1.account,
      });
      await token2.write.approve([lpToken.address, amount2Second], {
        account: users.user1.account,
      });

      await lpToken.write.addLiquidity(
        [amount1Second, amount2Second, amount1Second, amount2Second],
        { account: users.user1.account }
      );

      const lpBalanceSecond = await lpToken.read.balanceOf([
        users.user1.account.address,
      ]);

      assert.equal(lpBalanceSecond, amount2Second);
    });
  });

  describe("Remove Liquidity", () => {
    it("should remove liquidity successfully", async () => {
      const { lpToken, token1, token2, users, viem } = fixture;

      // Add liquidity first
      const amount1 = parseUnits("100", 18);
      const amount2 = parseUnits("200", 18);

      await token1.write.approve([lpToken.address, amount1]);
      await token2.write.approve([lpToken.address, amount2]);

      await lpToken.write.addLiquidity([amount1, amount2, amount1, amount2]);

      const lpBalance = await lpToken.read.balanceOf([
        users.deployer.account.address,
      ]);
      // Remove half of the liquidity
      const liquidityToRemove = lpBalance / 2n; //100n
      const removeTxn = lpToken.write.removeLiquidity([
        liquidityToRemove,
        0n,
        0n,
        users.deployer.account.address,
      ]);

      const token1ExpectedChange = parseUnits("50", 18);
      const token2ExpectedChange = parseUnits("100", 18);
      const lpChange = parseUnits("100", 18);
      await viem.assertions.erc20BalancesHaveChanged(
        removeTxn,
        token1.address,
        [
          {
            address: users.deployer.account.address,
            amount: token1ExpectedChange,
          },
          { address: lpToken.address, amount: -token1ExpectedChange },
        ]
      );

      await viem.assertions.erc20BalancesHaveChanged(
        removeTxn,
        token2.address,
        [
          {
            address: users.deployer.account.address,
            amount: token2ExpectedChange,
          },
          { address: lpToken.address, amount: -token2ExpectedChange },
        ]
      );

      await viem.assertions.erc20BalancesHaveChanged(
        removeTxn,
        lpToken.address,
        [
          {
            address: users.deployer.account.address,
            amount: -lpChange,
          },
        ]
      );
      const totalLPSupply = await lpToken.read.totalSupply();
      assert.equal(totalLPSupply, parseUnits("100", 18));
    });
  });

  describe("Swap Token1 to Token2 - Exact Amount In", () => {
    beforeEach(async function () {
      const { lpToken, token1, token2 } = fixture;

      // First liquidity provider
      const amount1First = parseUnits("100", 18);
      const amount2First = parseUnits("200", 18);

      await token1.write.approve([lpToken.address, amount1First]);
      await token2.write.approve([lpToken.address, amount2First]);

      await lpToken.write.addLiquidity([
        amount1First,
        amount2First,
        amount1First,
        amount2First,
      ]);
    });

    it("should apply 0.3% fee on swap", async () => {
      const { lpToken, token1, token2, users, viem } = fixture;
      // Swap 10 token1
      const swapAmount = parseUnits("10", 18);
      await token1.write.approve([lpToken.address, swapAmount]);
      const swapTxn = lpToken.write.swap1To2ExactAmountIn([swapAmount, 0n]);

      const expectedIn = swapAmount;
      const expectedOut = parseUnits("19.94", 18);
      await viem.assertions.erc20BalancesHaveChanged(swapTxn, token1.address, [
        { address: users.deployer.account.address, amount: -expectedIn },
        { address: lpToken.address, amount: expectedIn },
      ]);

      await viem.assertions.erc20BalancesHaveChanged(swapTxn, token2.address, [
        { address: users.deployer.account.address, amount: expectedOut },
        { address: lpToken.address, amount: -expectedOut },
      ]);
    });
  });

  describe("Swap Token1 to Token2 - Exact Amount Out", () => {
    beforeEach(async function () {
      const { lpToken, token1, token2 } = fixture;

      // First liquidity provider
      const amount1First = parseUnits("100", 18);
      const amount2First = parseUnits("200", 18);

      await token1.write.approve([lpToken.address, amount1First]);
      await token2.write.approve([lpToken.address, amount2First]);

      await lpToken.write.addLiquidity([
        amount1First,
        amount2First,
        amount1First,
        amount2First,
      ]);
    });
    it("should swap token1 for exact amount of token2 with fee", async () => {
      const { lpToken, token1, token2, users, viem } = fixture;
      // Swap for exact 10 token2
      const desiredOutput = parseUnits("10", 18);
      await token1.write.approve([lpToken.address, parseUnits("100", 18)]);

      const swapTxn = lpToken.write.swap1To2ExactAmountOut([
        desiredOutput,
        parseUnits("100", 18),
      ]);

      const expectedIn = (parseUnits("5", 18) * 10000n) / (10000n - 30n);
      const expectedOut = desiredOutput;
      await viem.assertions.erc20BalancesHaveChanged(swapTxn, token1.address, [
        { address: users.deployer.account.address, amount: -expectedIn },
        { address: lpToken.address, amount: expectedIn },
      ]);

      await viem.assertions.erc20BalancesHaveChanged(swapTxn, token2.address, [
        { address: users.deployer.account.address, amount: expectedOut },
        { address: lpToken.address, amount: -expectedOut },
      ]);
    });
  });
});
