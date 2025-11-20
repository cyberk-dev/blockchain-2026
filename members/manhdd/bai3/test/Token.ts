import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

async function deploy() {
  const { viem, ignition } = await network.connect();

  const [deployer] = await viem.getWalletClients();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: 100000000n * 10n ** 18n,
      },
    },
  });

  return { viem, ignition, token, deployer };
}

describe("Token (bai3)", async function () {
  it("deploys and initializes", async function () {
    const { token, deployer } = await deploy();

    const name = await token.read.name();
    const symbol = await token.read.symbol();

    assert.equal(name, "Cyberk");
    assert.equal(symbol, "CBK");
  });

  it("allows buying tokens with correct payment", async function () {
    const { token, deployer } = await deploy();

    // buy 1 token with price 0.1 ETH per token unit scaled by decimals
    const amount = 1000000000000000000n; // 1e18
    const value = 100000000000000000n; // 0.1 ETH

    await token.write.buyToken([amount], { value });

    const balance = await token.read.balanceOf([deployer.account.address]);
    // after buying, the caller (deployer) will have minted tokens; balance should be >= amount
    assert.ok(balance >= amount);
  });
});
