import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";
import { mulDivRoundingUp } from "../test/utils.js";
import { getAddress, parseEther } from "viem";
import { getEventArgs } from "./utils.js";

describe("Token Factory", async function () {
  const { ignition, viem, provider } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, feeRecipient] = await viem.getWalletClients();
  const FEE_PERCENTAGE = 500n; // 5%
  const FEE_DENOMINATOR = 10_000n;
  const TOKEN_CREATION_FEE = parseEther("0.01");

  it("should correctly calculate buy price after initial purchase", async function () {
    const { factory, usdt } = await ignition.deploy(
      TokenFactoryWithBeaconModule,
      {
        parameters: {
          TokenFactoryWithBeaconModule: {
            name: "tuantt",
            symbol: "tt",
            initial: 1_000_000n * 10n ** 18n,
            feeRecipient: feeRecipient.account.address,
          },
        },
      }
    );

    const createTx = factory.write.createToken(
      ["BondingCurveToken", "BCT", usdt.address],
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
    const tokenContract = await viem.getContractAt("Token", tokenAddress);

    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5B+2+*+x+%2B+2%2C%7Bx%2C1%2C1000%7D%5D
    const s = 0n; // initial supply
    const m = 1000n; // amount to buy
    const _a = 2n; // slope
    const _b = 2n; // intercept
    const expectedCost = 1003000n;
    const cost = await tokenContract.read.getCost([s, m, _a, _b]);
    const fee = mulDivRoundingUp(cost, FEE_PERCENTAGE, FEE_DENOMINATOR);
    const totalCost = cost + fee;

    assert.equal(
      cost,
      expectedCost,
      "Expected cost for first token purchase should match"
    );

    // approve USDT spending
    const usdtAddress = await tokenContract.read.usdt();
    const usdtContract = await viem.getContractAt("USDT", usdtAddress);
    const approveTx = await usdtContract.write.approve([
      tokenContract.address,
      totalCost,
    ]);
    assert.ok(approveTx, "USDT approval transaction should succeed");

    const txn = tokenContract.write.buyTokens([m, _a, _b]);

    await viem.assertions.emitWithArgs(txn, tokenContract, "TokensPurchased", [
      getAddress(deployer.account.address),
      totalCost,
      m,
      fee,
    ]);
  });
});
