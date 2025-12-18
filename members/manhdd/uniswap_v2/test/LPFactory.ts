import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, parseEther, formatTransactionRequest } from "viem";
import { network } from "hardhat";
import { extractEvent } from "./utils.js";

describe("TokenFactory", async function () {
  const { viem, networkName } = await network.connect();
  const publicClient = await viem.getPublicClient();

  async function deployFixture() {
    const [owner] = await viem.getWalletClients();

    const factory = await viem.deployContract("LPFactory", []);

    return { owner, factory };
  }

  it("should create a new LPToken via factory", async function () {
    const tokenA = await viem.deployContract("Token", [
      "USDT",
      "USDT",
      parseUnits("1000000", 18),
    ]);
    const tokenB = await viem.deployContract("Token", [
      "USDC",
      "USDC",
      parseUnits("1000000", 6),
    ]);

    const { factory } = await deployFixture();

    const allPairsBefore = await factory.read.getAllPairs();

    const tx = await factory.write.createPair([tokenA.address, tokenB.address]);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: tx,
    });

    console.log("Transaction status:", receipt.status);

    const pairAddress = await factory.read.getPair([
      tokenA.address,
      tokenB.address,
    ]);

    console.log("New LPToken deployed at:", pairAddress);

    const allPairsAfter = await factory.read.getAllPairs();

    assert.equal(
      (allPairsAfter as string[]).length,
      (allPairsBefore as string[]).length + 1
    );
  });
});
