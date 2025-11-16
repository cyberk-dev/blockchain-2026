import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { parseUnits } from "viem";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Deploy ignition", async function () {
    const name = "CBK";
    const symbol = "ABC";
    const initialSupply = parseUnits("100", 18);

    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name,
          symbol,
          initialSupply,
        },
      },
    });

    // Read token information
    const tokenName = await token.read.name();
    const tokenSymbol = await token.read.symbol();
    const tokenTotalSupply = await token.read.totalSupply();

    // Match with input parameters
    assert.equal(tokenName, name, "Token name should match");
    assert.equal(tokenSymbol, symbol, "Token symbol should match");
    assert.equal(tokenTotalSupply, initialSupply, "Token total supply should match");
  });
});
