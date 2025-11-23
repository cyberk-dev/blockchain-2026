import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";
import { expect } from "chai";

describe("TokenFactoryWithBeacon - Full Flow", async function () {
  const { ignition, viem, provider } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  it("should deploy factory with beacon and create tokens", async function () {
    const deployed = await ignition.deploy(TokenFactoryWithBeaconModule, {
      parameters: {
        TokenFactoryWithBeaconModule: {
          name: "tuantt",
          symbol: "tt",
          initial: 1_000_000n * 10n ** 18n,
        },
      },
    });
    const { factory, tokenBeacon, factoryProxy, erc20Token } = deployed;
    assert.ok(tokenBeacon, "Token beacon should be deployed");

    assert.ok(factoryProxy, "Factory proxy should be deployed");

    const beaconAddress = await factory.read.tokenBeaconAddress();
    assert.ok(beaconAddress, "Factory should have beacon address set");

    const createTx = await factory.write.createToken([
      "TestToken",
      "TST",
      erc20Token.address,
    ]);
    assert.ok(createTx, "Create token transaction should succeed");
  });

  it("should allow factory owner to mint tokens", async function () {
    const { factory, erc20Token } = await ignition.deploy(
      TokenFactoryWithBeaconModule,
      {
        parameters: {
          TokenFactoryWithBeaconModule: {
            name: "tuantt",
            symbol: "tt",
            initial: 1_000_000n * 10n ** 18n,
          },
        },
      }
    );

    const createTx = await factory.write.createToken([
      "MintableToken",
      "MINT",
      erc20Token.address,
    ]);
    assert.ok(createTx, "Token creation should succeed");
  });

  it("should correctly calculate buy price after initial purchase", async function () {
    // 1. Deploy Factory and create a new Token instance
    const { factory, erc20Token } = await ignition.deploy(
      TokenFactoryWithBeaconModule,
      {
        parameters: {
          TokenFactoryWithBeaconModule: {
            name: "tuantt",
            symbol: "tt",
            initial: 1_000_000n * 10n ** 18n,
          },
        },
      }
    );
    const createTx = await factory.write.createToken([
      "BondingCurveToken",
      "BCT",
      erc20Token.address,
    ]);
    const receiptCreate = await publicClient.waitForTransactionReceipt({
      hash: createTx,
    });
    const logs = await publicClient.getContractEvents({
      address: factory.address,
      abi: factory.abi,
      eventName: "TokenCreated",
    });
    const tokenCreatedLog = logs.find(
      (log) => log.transactionHash === receiptCreate.transactionHash
    );
    const tokenAddress = tokenCreatedLog?.args?.tokenAddress as `0x${string}`;
    const tokenContract = await viem.getContractAt("Token", tokenAddress);

    // 2. Buy the first full token
    const s = 0n; // initial supply
    const m = 1000n; // amount to buy
    const _a = 2n; // slope
    const _b = 2n; // intercept
    const expectedCost = 1003000n;
    const cost = await tokenContract.read.getCost([s, m, _a, _b]);

    assert.equal(
      cost,
      expectedCost,
      "Expected cost for first token purchase should match"
    );

    // approve USDT spending
    const usdtAddress = await tokenContract.read.usdt();
    const usdtContract = await viem.getContractAt("MockERC20", usdtAddress);
    const approveTx = await usdtContract.write.approve([
      tokenContract.address,
      1_000_000n * 10n ** 18n,
    ]);
    assert.ok(approveTx, "USDT approval transaction should succeed");

    const txn = await tokenContract.write.buyTokens([m, _a, _b]);

    assert.ok(txn, "First token purchase transaction should succeed");
    await expect(txn).to.erc20BalancesHaveChanged(usdtAddress, [
      { address: deployer.account.address, amount: -cost },
      { address: tokenContract.address, amount: cost },
    ]);
  });
});
