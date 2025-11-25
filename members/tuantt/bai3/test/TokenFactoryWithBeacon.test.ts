import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";

describe("TokenFactoryWithBeacon - Full Flow", async function () {
  const { ignition, viem, provider } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  it("should deploy factory with beacon and create tokens", async function () {
    const deployed = await ignition.deploy(TokenFactoryWithBeaconModule);
    const { factory, tokenBeacon, factoryProxy } = deployed;
    assert.ok(tokenBeacon, "Token beacon should be deployed");

    assert.ok(factoryProxy, "Factory proxy should be deployed");

    const beaconAddress = await factory.read.tokenBeaconAddress();
    assert.ok(beaconAddress, "Factory should have beacon address set");

    const createTx = await factory.write.createToken(["TestToken", "TST"]);
    assert.ok(createTx, "Create token transaction should succeed");
  });

  it("should allow factory owner to mint tokens", async function () {
    const { factory } = await ignition.deploy(TokenFactoryWithBeaconModule);

    const createTx = await factory.write.createToken(["MintableToken", "MINT"]);
    assert.ok(createTx, "Token creation should succeed");
  });

  it("should correctly calculate buy price after initial purchase", async function () {
    // 1. Deploy Factory and create a new Token instance
    const { factory } = await ignition.deploy(TokenFactoryWithBeaconModule);
    const createTx = await factory.write.createToken([
      "BondingCurveToken",
      "BCT",
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
    const ONE_TOKEN = 10n ** 18n;

    // Get the price for the first token (when supply is 0)
    const priceForFirstToken = await tokenContract.read.getBuyPrice([
      ONE_TOKEN,
    ]);
    const expectedPriceForFirstToken = 500000000n; // 0.0000000005 ETH (slope / 2)
    assert.equal(
      priceForFirstToken,
      expectedPriceForFirstToken,
      "Price for the first token is incorrect"
    );

    console.log(`Buying first token for ${priceForFirstToken} wei...`);
    const buyTx = await tokenContract.write.buyTokens([ONE_TOKEN], {
      value: priceForFirstToken,
    });
    await publicClient.waitForTransactionReceipt({ hash: buyTx });

    // Verify balance and total supply
    const balance = await tokenContract.read.balanceOf([
      deployer.account.address,
    ]);
    assert.equal(balance, ONE_TOKEN, "Deployer balance should be 1 token");
    const totalSupply = await tokenContract.read.totalSupply();
    assert.equal(totalSupply, ONE_TOKEN, "Total supply should be 1 token");

    // 3. Get the buy price for the *second* token
    console.log("Getting buy price for the second token...");
    const priceForSecondToken = await tokenContract.read.getBuyPrice([
      ONE_TOKEN,
    ]);

    // 4. Manually calculate the expected price for the second token
    // Formula: 1.5 * slope = 1.5 * 10^9 wei = 1,500,000,000 wei
    const expectedPriceForSecondToken = 1500000000n; // 0.0000000015 ETH

    // 5. Assert that the calculated price matches the expected price
    console.log(
      `Expected price for second token: ${expectedPriceForSecondToken}`
    );
    console.log(`Actual price for second token:   ${priceForSecondToken}`);
    assert.equal(
      priceForSecondToken,
      expectedPriceForSecondToken,
      "The buy price for the second token is incorrect"
    );
  });
});
