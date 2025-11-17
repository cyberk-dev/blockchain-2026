import assert from "node:assert/strict";
import { describe, it } from "node:test";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

import { network } from "hardhat";
import { parseUnits, getAddress } from "viem";

describe("TokenFactory", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, creator1, creator2] = await viem.getWalletClients();

  it("Should deploy TokenFactory successfully", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    assert.ok(tokenFactory.address, "TokenFactory should have an address");
    console.log(`TokenFactory deployed at: ${tokenFactory.address}`);
  });

  it("Should create a new token with specified parameters", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    const tokenName = "MyToken";
    const tokenSymbol = "MTK";
    const initialSupply = parseUnits("1000000", 18);

    // Create token
    const tx = await tokenFactory.write.createToken([
      tokenName,
      tokenSymbol,
      initialSupply,
    ]);

    // Get the created token address from events
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(logs.length, 1, "Should emit one TokenCreated event");
    const event = logs[0];

    assert.equal(
      event.args.creator,
      getAddress(deployer.account.address),
      "Creator should be the deployer"
    );
    assert.equal(event.args.name, tokenName, "Token name should match");
    assert.equal(event.args.symbol, tokenSymbol, "Token symbol should match");
    assert.equal(
      event.args.initialSupply,
      initialSupply,
      "Initial supply should match"
    );

    console.log(`Created token at: ${event.args.tokenAddress}`);
    console.log(
      `Token details: ${tokenName} (${tokenSymbol}) - ${initialSupply} wei`
    );
  });

  it("Should transfer all tokens to creator", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    const initialSupply = parseUnits("5000", 18);
    const tx = await tokenFactory.write.createToken([
      "CreatorToken",
      "CTK",
      initialSupply,
    ]);

    // Get token address from event
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    const tokenAddress = logs[0].args.tokenAddress;

    // Get Token contract instance
    const token = await viem.getContractAt(
      "Token",
      tokenAddress as `0x${string}`
    );

    // Check creator's balance
    const creatorBalance = await token.read.balanceOf([
      deployer.account.address,
    ]);
    assert.equal(
      creatorBalance,
      initialSupply,
      "Creator should receive all initial supply"
    );

    console.log(`Creator received ${creatorBalance} tokens`);
  });

  it("Should track all deployed tokens", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    // Create multiple tokens
    await tokenFactory.write.createToken([
      "Token1",
      "TK1",
      parseUnits("1000", 18),
    ]);
    await tokenFactory.write.createToken([
      "Token2",
      "TK2",
      parseUnits("2000", 18),
    ]);
    await tokenFactory.write.createToken([
      "Token3",
      "TK3",
      parseUnits("3000", 18),
    ]);

    // Check count
    const count = await tokenFactory.read.getDeployedTokensCount();
    assert.equal(count, 3n, "Should have 3 deployed tokens");

    // Get all tokens
    const allTokens = await tokenFactory.read.getAllDeployedTokens();
    assert.equal(allTokens.length, 3, "Should return 3 token addresses");

    console.log(`Total tokens created: ${count}`);
    console.log(`Token addresses:`, allTokens);
  });

  it("Should track tokens by creator", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    // Creator1 creates 2 tokens
    const factory1 = await viem.getContractAt(
      "TokenFactory",
      tokenFactory.address,
      { client: { wallet: creator1 } }
    );
    await factory1.write.createToken([
      "Creator1Token1",
      "C1T1",
      parseUnits("1000", 18),
    ]);
    await factory1.write.createToken([
      "Creator1Token2",
      "C1T2",
      parseUnits("2000", 18),
    ]);

    // Creator2 creates 1 token
    const factory2 = await viem.getContractAt(
      "TokenFactory",
      tokenFactory.address,
      { client: { wallet: creator2 } }
    );
    await factory2.write.createToken([
      "Creator2Token1",
      "C2T1",
      parseUnits("3000", 18),
    ]);

    // Check creator1's tokens
    const creator1Tokens = await tokenFactory.read.getTokensByCreator([
      creator1.account.address,
    ]);
    assert.equal(creator1Tokens.length, 2, "Creator1 should have 2 tokens");

    // Check creator2's tokens
    const creator2Tokens = await tokenFactory.read.getTokensByCreator([
      creator2.account.address,
    ]);
    assert.equal(creator2Tokens.length, 1, "Creator2 should have 1 token");

    console.log(`Creator1 tokens (${creator1Tokens.length}):`, creator1Tokens);
    console.log(`Creator2 tokens (${creator2Tokens.length}):`, creator2Tokens);
  });

  it("Should return correct token creator", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    const tx = await tokenFactory.write.createToken([
      "TestToken",
      "TST",
      parseUnits("1000", 18),
    ]);

    // Get token address
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    const tokenAddress = logs[0].args.tokenAddress;

    // Check creator
    const creator = await tokenFactory.read.getTokenCreator([
      tokenAddress as `0x${string}`,
    ]);
    assert.equal(
      getAddress(creator),
      getAddress(deployer.account.address),
      "Should return correct creator"
    );

    console.log(`Token ${tokenAddress} created by ${creator}`);
  });

  it("Should verify if token is from factory", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    const tx = await tokenFactory.write.createToken([
      "FactoryToken",
      "FTK",
      parseUnits("1000", 18),
    ]);

    // Get token address
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    const tokenAddress = logs[0].args.tokenAddress;

    // Check if from factory
    const isFromFactory = await tokenFactory.read.isTokenFromFactory([
      tokenAddress as `0x${string}`,
    ]);
    assert.equal(isFromFactory, true, "Token should be from factory");

    // Check random address
    const randomAddress = "0x0000000000000000000000000000000000000001";
    const isRandomFromFactory = await tokenFactory.read.isTokenFromFactory([
      randomAddress,
    ]);
    assert.equal(
      isRandomFromFactory,
      false,
      "Random address should not be from factory"
    );

    console.log(`Token ${tokenAddress} is from factory: ${isFromFactory}`);
  });

  it("Should revert when creating token with empty name", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    try {
      await tokenFactory.write.createToken(["", "SYM", parseUnits("1000", 18)]);
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("name cannot be empty"),
        "Should revert with correct error message"
      );
      console.log("Correctly rejected empty name");
    }
  });

  it("Should revert when creating token with empty symbol", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    try {
      await tokenFactory.write.createToken([
        "TokenName",
        "",
        parseUnits("1000", 18),
      ]);
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("symbol cannot be empty"),
        "Should revert with correct error message"
      );
      console.log("Correctly rejected empty symbol");
    }
  });

  it("Should revert when creating token with zero initial supply", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    try {
      await tokenFactory.write.createToken(["TokenName", "SYM", 0n]);
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("initial supply must be greater than 0"),
        "Should revert with correct error message"
      );
      console.log("Correctly rejected zero initial supply");
    }
  });

  it("Should emit TokenCreated event with correct parameters", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

    const tokenName = "EventToken";
    const tokenSymbol = "EVT";
    const initialSupply = parseUnits("10000", 18);

    const tx = await tokenFactory.write.createToken([
      tokenName,
      tokenSymbol,
      initialSupply,
    ]);

    // Get event
    const receipt = await publicClient.getTransactionReceipt({ hash: tx });
    const logs = await publicClient.getContractEvents({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(logs.length, 1, "Should emit exactly one event");

    const event = logs[0];
    assert.ok(event.args.tokenAddress, "Event should include token address");
    assert.equal(
      event.args.creator,
      getAddress(deployer.account.address),
      "Event should include creator"
    );
    assert.equal(event.args.name, tokenName, "Event should include token name");
    assert.equal(
      event.args.symbol,
      tokenSymbol,
      "Event should include token symbol"
    );
    assert.equal(
      event.args.initialSupply,
      initialSupply,
      "Event should include initial supply"
    );

    console.log(`TokenCreated event emitted successfully`);
    console.log(`Event data:`, event.args);
  });
});
