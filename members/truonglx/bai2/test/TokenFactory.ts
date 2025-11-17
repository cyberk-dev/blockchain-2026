import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, getAddress, decodeEventLog } from "viem";

import { network } from "hardhat";

describe("TokenFactory", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, creator] = await viem.getWalletClients();

  it("Deploy TokenFactory", async function () {
    const factory = await viem.deployContract("TokenFactory");
    console.log("TokenFactory deployed at:", factory.address);
  });

  it("Should create token with custom name and symbol", async function () {
    const factory = await viem.deployContract("TokenFactory");
    const name = "Factory Token";
    const symbol = "FCT";
    const totalSupply = parseUnits("1000000", 18);

    const hash = await factory.write.createToken([name, symbol, totalSupply], {
      account: creator.account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find the TokenCreated event in the receipt
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    assert.ok(tokenCreatedLog, "TokenCreated event should be emitted");

    // Decode the event
    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    const tokenAddress = (decoded?.args as any)?.tokenAddress as `0x${string}`;

    assert.ok(tokenAddress, "Token address should not be zero");
    assert.notEqual(
      tokenAddress,
      "0x0000000000000000000000000000000000000000",
      "Token address should not be zero address"
    );

    // Verify token properties
    const tokenContract = await viem.getContractAt("Token", tokenAddress);
    const tokenName = await tokenContract.read.name();
    const tokenSymbol = await tokenContract.read.symbol();
    const tokenTotalSupply = await tokenContract.read.totalSupply();
    const factoryBalance = await tokenContract.read.balanceOf([
      factory.address,
    ]);
    const creatorBalance = await tokenContract.read.balanceOf([
      creator.account.address,
    ]);

    assert.strictEqual(tokenName, name, "Token name should match");
    assert.strictEqual(tokenSymbol, symbol, "Token symbol should match");
    assert.strictEqual(
      tokenTotalSupply,
      totalSupply,
      "Token total supply should match"
    );
    assert.strictEqual(
      factoryBalance,
      totalSupply,
      "Factory should receive all tokens (as msg.sender in Token constructor)"
    );
    assert.strictEqual(
      creatorBalance,
      0n,
      "Creator should have zero balance initially"
    );

    console.log("Token created at:", tokenAddress);
    console.log("Token name:", tokenName);
    console.log("Token symbol:", tokenSymbol);
    console.log("Token total supply:", tokenTotalSupply.toString());
  });

  it("Should emit TokenCreated event with correct parameters", async function () {
    const factory = await viem.deployContract("TokenFactory");
    const name = "Test Token";
    const symbol = "TST";
    const totalSupply = parseUnits("500000", 18);

    const hash = await factory.write.createToken([name, symbol, totalSupply], {
      account: creator.account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find the TokenCreated event in the receipt
    const tokenCreatedLog = receipt.logs.find(
      (log) => getAddress(log.address) === getAddress(factory.address)
    );

    assert.ok(tokenCreatedLog, "TokenCreated event should be in receipt");

    // Decode the event
    const decodedEvent = decodeEventLog({
      abi: factory.abi,
      data: tokenCreatedLog!.data,
      topics: tokenCreatedLog!.topics,
    });

    assert.strictEqual(
      decodedEvent.eventName,
      "TokenCreated",
      "Event name should be TokenCreated"
    );
    const eventArgs = decodedEvent?.args as any;
    assert.ok(eventArgs?.tokenAddress, "Token address should be present");
    assert.strictEqual(eventArgs?.name, name, "Event name should match");
    assert.strictEqual(eventArgs?.symbol, symbol, "Event symbol should match");
    assert.strictEqual(
      eventArgs?.totalSupply,
      totalSupply,
      "Event total supply should match"
    );
    assert.strictEqual(
      getAddress((eventArgs?.creator as `0x${string}`) || "0x0"),
      getAddress(creator.account.address),
      "Event creator should match"
    );
  });

  it("Should create multiple tokens with different parameters", async function () {
    const factory = await viem.deployContract("TokenFactory");
    const tokens = [
      { name: "Token A", symbol: "TKA", supply: parseUnits("1000", 18) },
      { name: "Token B", symbol: "TKB", supply: parseUnits("2000", 18) },
      { name: "Token C", symbol: "TKC", supply: parseUnits("3000", 18) },
    ];

    const createdAddresses: `0x${string}`[] = [];

    for (const token of tokens) {
      const hash = await factory.write.createToken(
        [token.name, token.symbol, token.supply],
        {
          account: creator.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const tokenCreatedLog = receipt.logs.find(
        (log) => getAddress(log.address) === getAddress(factory.address)
      );

      assert.ok(tokenCreatedLog, "TokenCreated event should be emitted");

      const decoded = decodeEventLog({
        abi: factory.abi,
        data: tokenCreatedLog!.data,
        topics: tokenCreatedLog!.topics,
      });

      const tokenAddress = (decoded?.args as any)
        ?.tokenAddress as `0x${string}`;
      createdAddresses.push(tokenAddress);

      // Verify each token
      const tokenContract = await viem.getContractAt("Token", tokenAddress);
      const tokenName = await tokenContract.read.name();
      const tokenSymbol = await tokenContract.read.symbol();
      const tokenSupply = await tokenContract.read.totalSupply();

      assert.strictEqual(tokenName, token.name);
      assert.strictEqual(tokenSymbol, token.symbol);
      assert.strictEqual(tokenSupply, token.supply);
    }

    // Verify all addresses are unique
    const uniqueAddresses = new Set(
      createdAddresses.map((addr) => getAddress(addr))
    );
    assert.strictEqual(
      uniqueAddresses.size,
      tokens.length,
      "All token addresses should be unique"
    );

    console.log("Created", tokens.length, "tokens successfully");
  });
});
