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

    const logs = await publicClient.getLogs({
      address: factory.address,
      event: factory.abi.find((abi) => abi.name === "TokenCreated"),
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(logs.length, 1);

    const event = decodeEventLog({
      abi: factory.abi,
      data: logs[0].data,
      topics: logs[0].topics,
    });

    assert.equal(event.args.name, name);
    assert.equal(event.args.symbol, symbol);

    const token = await viem.getContractAt("Token", event.args.tokenAddress);
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
