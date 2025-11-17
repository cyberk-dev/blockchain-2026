import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { decodeEventLog, parseUnits } from "viem";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

describe("TokenFactory", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  let factory: Awaited<ReturnType<typeof viem.getContractAt<"TokenFactory">>>;

  it("Should deploy TokenFactory", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);
    console.log("tokenFactory=", tokenFactory.address);
    factory = await viem.getContractAt("TokenFactory", tokenFactory.address);
    assert.ok(factory.address);
  });

  it("Should create token and emit TokenCreated event", async function () {
    const [deployer, creator] = await viem.getWalletClients();
    const name = "Token";
    const symbol = "TKN";
    const supply = parseUnits("100000", 18);
    const tx = await factory.write.createToken([name, symbol, supply], {
      account: creator.account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");

    const events = await publicClient.getContractEvents({
      address: factory.address,
      abi: factory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
      strict: true,
    });

    assert.equal(events[0].args.name, name);
    assert.equal(events[0].args.symbol, symbol);

    const token = await viem.getContractAt(
      "Token",
      events[0].args.tokenAddress
    );

    assert.equal(
      (await token.read.owner()).toLowerCase(),
      creator.account.address.toLowerCase()
    );
  });

  it("Should return correct token count", async function () {
    const count = await factory.read.getTokenCount();
    assert.equal(count, 1n);
  });
});
