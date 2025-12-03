import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { network } from "hardhat";
import { decodeEventLog, parseUnits } from "viem";

describe("Token", async function () {
  const { viem, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, buyer, treasury] = await viem.getWalletClients();

  //const basePrice = 10n ** 18n;
  const oneToken = 10n ** 18n;
  const tenTokens = 10n * oneToken;
  const FEE_BPS = 300n; // 3%
  const SLOPE = 1n;
  const BASE_PRICE = 2_000_000n;
  const TOKEN_UNIT = 10n ** 18n;

  async function deployThroughFactory() {
    const blockNumber = await publicClient.getBlockNumber();
    const { timestamp } = await publicClient.getBlock({ blockNumber });
    const endTime = timestamp + 3600n;

    const paymentToken = await viem.deployContract("MockUSDT");
    await paymentToken.write.mint([
      buyer.account.address,
      parseUnits("1000", 6),
    ]);

    const tokenFactory = await viem.deployContract("TokenFactory");
    const creationTx = tokenFactory.write.create(
      [
        "Bonding Curve Token",
        "BCT",
        paymentToken.address,
        treasury.account.address,
        endTime,
        SLOPE,
        BASE_PRICE,
        FEE_BPS,
      ],
      { account: deployer.account }
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: await creationTx,
    });
    const log = receipt.logs.find((entry) => {
      try {
        const decoded = decodeEventLog({
          abi: tokenFactory.abi,
          data: entry.data,
          topics: entry.topics,
        });
        return decoded.eventName === "TokenCreated";
      } catch (err) {
        return false;
      }
    });
    if (!log) throw new Error("TokenCreated event not found");
    const decoded = decodeEventLog({
      abi: tokenFactory.abi,
      data: log.data,
      topics: log.topics,
    });
    const tokenAddress = (decoded.args as any).token as `0x${string}`;
    const token = await viem.getContractAt("Token", tokenAddress);

    return { token, paymentToken };
  }

  let token: Awaited<ReturnType<typeof deployThroughFactory>>["token"];
  let paymentToken: Awaited<
    ReturnType<typeof deployThroughFactory>
  >["paymentToken"];

  beforeEach(async () => {
    ({ token, paymentToken } = await networkHelpers.loadFixture(
      deployThroughFactory
    ));
  });

  it("computes bonding curve cost from state parameters", async function () {
    const s = 0n;
    const m = 10n ** 18n;
    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B2000%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
    const expectedCost = 50_000_000_000_200n;

    const cost = await token.read.getCost([s, m]);

    assert.equal(cost, expectedCost);
  });

  it("mints tokens and splits payment with a 3% fee", async function () {
    const amountToBuy = 3n;
    const cost = await token.read.getCost([0n, amountToBuy]);
    const fee = (cost * FEE_BPS) / 10_000n;
    const proceeds = cost - fee;

    await paymentToken.write.approve([token.address, cost], {
      account: buyer.account,
    });

    const buyTx = token.write.buy([amountToBuy], { account: buyer.account });

    await viem.assertions.erc20BalancesHaveChanged(
      buyTx,
      paymentToken.address,
      [
        { address: buyer.account.address, amount: -cost },
        { address: treasury.account.address, amount: fee },
        { address: deployer.account.address, amount: proceeds },
      ]
    );

    const buyerBalance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(buyerBalance, amountToBuy * TOKEN_UNIT);

    const sold = await token.read.tokensSold();
    assert.equal(sold, amountToBuy);
  });

  it("reverts when trying to buy zero tokens", async function () {
    await assert.rejects(
      token.write.buy([0n], { account: buyer.account }),
      /InvalidAmount/
    );
  });
});
