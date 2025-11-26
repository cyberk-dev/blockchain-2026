import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, parseEther, formatEther } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

// Helper function to deploy token with test parameters
async function deployToken() {
  const { ignition, viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();
  
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Test Token",
        symbol: "TEST",
        initialSupply: 0, // 1M tokens
        slope: 10n**22n, // 1 ETH per token increase
        basePrice: 1n, // 1 ETH base price
      },
    },
  });

  // Type assertion to access all contract methods
  const tokenContract = token as any;

  return { token: tokenContract, deployer, viem };
}

describe("Token", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [ deployer] = await viem.getWalletClients();

  it("Should deploy token with correct parameters", async function () {
    const { token, deployer } = await deployToken();

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const totalSupply = await token.read.totalSupply();
    const slope = await token.read.a();
    const basePrice = await token.read.b();
    const deployerBalance = await token.read.balanceOf([deployer.account.address]);

    assert.equal(name, "Test Token", "Name should match");
    assert.equal(symbol, "TEST", "Symbol should match");
    assert.equal(totalSupply, parseUnits("0", 18), "Total supply should be 0");
    assert.equal(deployerBalance, parseUnits("0", 18), "Deployer should have initial supply");
    assert.equal(slope, 10n**22n, "Slope should match");
    assert.equal(basePrice, 1n, "Base price should match");
  })
  it("Should buy 1 token and then 1 tokens should cost the same as buying 2 tokens at once", async function () {
    const { token, deployer } = await deployToken();

    const cost1 = await token.read.getCost([0n, 1n*10n**18n]);
    console.log("cost1", cost1);
    const cost2 = await token.read.getCost([1n*10n**18n, 2n*10n**18n]);
    console.log("cost2", cost2);
    const cost3 = await token.read.getCost([0n, 3n*10n**18n]);
    console.log("cost3", cost3);
    assert.equal(cost1 + cost2, cost3, "Buying 1 then 2 tokens should cost same as 3 at once");
  })
});

