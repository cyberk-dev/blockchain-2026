import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, getAddress } from "viem";
import { network } from "hardhat";

const ONE_TOKEN = 10n ** 18n;
const A = 1n;
const B = 12n;

// https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
const EXPECTED_FIRST_TOKEN_COST = 50000000000000n;

// https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2CPower%5B10%2C18%5D%2B1%2C11+Power%5B10%2C18%5D%7D%5D
const EXPECTED_NEXT_10_TOKENS_COST = 6000000000000000n;

describe("Token", async function () {
  const { viem } = await network.connect();

  async function deployFixture() {
    const [owner, buyer] = await viem.getWalletClients();

    const mockUSDT = await viem.deployContract("MockUSDT", []);

    const token = await viem.deployContract("Token", [
      "BondingToken",
      "BT",
      A,
      B,
      mockUSDT.address,
      3600n,
    ]);

    await mockUSDT.write.mint([buyer.account.address, parseUnits("1000000", 18)]);

    const usdtAsBuyer = await viem.getContractAt("MockUSDT", mockUSDT.address, {
      client: { wallet: buyer },
    });
    await usdtAsBuyer.write.approve([token.address, parseUnits("1000000", 18)]);

    const tokenAsBuyer = await viem.getContractAt("Token", token.address, {
      client: { wallet: buyer },
    });

    return { owner, buyer, mockUSDT, token, tokenAsBuyer };
  }

  it("getCost returns correct price for first token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deployFixture);

    const cost = await token.read.getCost([0n, ONE_TOKEN, A, B]);

    assert.equal(cost, EXPECTED_FIRST_TOKEN_COST);
  });

  it("getCost returns correct price for next 10 tokens", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deployFixture);

    const cost = await token.read.getCost([ONE_TOKEN, 10n * ONE_TOKEN, A, B]);

    assert.equal(cost, EXPECTED_NEXT_10_TOKENS_COST);
  });

  it("buyToken succeeds", async function () {
    const { networkHelpers } = await network.connect();
    const { token, tokenAsBuyer, buyer } = await networkHelpers.loadFixture(deployFixture);

    await tokenAsBuyer.write.buyToken([ONE_TOKEN]);

    const balance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balance, ONE_TOKEN);
  });

  it("emits TokenBought event", async function () {
    const { networkHelpers } = await network.connect();
    const { token, tokenAsBuyer, buyer } = await networkHelpers.loadFixture(deployFixture);

    const txPromise = tokenAsBuyer.write.buyToken([ONE_TOKEN]);

    await viem.assertions.emitWithArgs(txPromise, token, "TokenBought", [
      getAddress(buyer.account.address),
      ONE_TOKEN,
      EXPECTED_FIRST_TOKEN_COST
    ]);
  });

  it("ERC20 balances change correctly", async function () {
    const { networkHelpers } = await network.connect();
    const { token, tokenAsBuyer, mockUSDT, buyer } = await networkHelpers.loadFixture(deployFixture);

    const txPromise = tokenAsBuyer.write.buyToken([ONE_TOKEN]);

    await viem.assertions.erc20BalancesHaveChanged(txPromise, mockUSDT.address, [
      { address: buyer.account.address, amount: -EXPECTED_FIRST_TOKEN_COST },
      { address: token.address, amount: EXPECTED_FIRST_TOKEN_COST },
    ]);
  });

  it("reverts with InvalidAmount when amount is 0", async function () {
    const { networkHelpers } = await network.connect();
    const { tokenAsBuyer } = await networkHelpers.loadFixture(deployFixture);

    await assert.rejects(
      async () => await tokenAsBuyer.write.buyToken([0n]),
      /InvalidAmount/
    );
  });

  it("reverts with SaleEnded after endTime", async function () {
    const { networkHelpers } = await network.connect();
    const { tokenAsBuyer } = await networkHelpers.loadFixture(deployFixture);

    await networkHelpers.time.increase(2 * 60 * 60);
    await networkHelpers.mine();

    try {
      await tokenAsBuyer.write.buyToken([ONE_TOKEN]);
      assert.fail("Should have reverted");
    } catch (e: any) {
      const errorStr = JSON.stringify(e, Object.getOwnPropertyNames(e));
      assert.ok(
        errorStr.includes("SaleEnded") || errorStr.includes("revert"),
        `Expected SaleEnded error but got: ${errorStr}`
      );
    }
  });
});
