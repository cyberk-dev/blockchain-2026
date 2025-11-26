import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, getAddress } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import MockERC20Module from "../ignition/modules/MockERC20.js";

// Helper function to deploy MockERC20 and Token
async function deployContracts() {
  const { ignition, viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  // Deploy MockERC20 first
  const { mockERC20 } = await ignition.deploy(MockERC20Module, {
    parameters: {
      MockERC20Module: {
        name: "Mock USDT",
        symbol: "USDT",
        initialSupply: parseUnits("1000000", 18),
      },
    },
  });

  const mockERC20Contract = mockERC20 as any;

  // Deploy Token with paymentTokenAddress
  // slope = 1e22, basePrice = 12 => first token costs ~0.00005 ETH
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Test Token",
        symbol: "TEST",
        initialSupply: 0n,
        slope: 10n ** 22n,
        basePrice: 12n,
        paymentTokenAddress: mockERC20Contract.address,
      },
    },
  });

  return {
    token: token as any,
    mockERC20: mockERC20Contract,
    deployer,
    viem,
  };
}

describe("Token", async function () {
  it("Should deploy token with correct parameters", async function () {
    const { token, mockERC20, deployer } = await deployContracts();

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const paymentToken = await token.read.paymentToken();

    assert.equal(name, "Test Token");
    assert.equal(symbol, "TEST");
    assert.equal(paymentToken.toLowerCase(), mockERC20.address.toLowerCase());
  });

  it("Should buy 1 token then buy 2 tokens", async function () {
    const { token, mockERC20, deployer, viem } = await deployContracts();
    const buyerAddress = deployer.account.address;

    // Approve payment token
    const approveAmount = parseUnits("10000", 18);
    await mockERC20.write.approve([token.address, approveAmount]);

    // Get cost for 1 token
    const amount1 = parseUnits("1", 18);
    const cost1 = await token.read.getCost([0n, amount1]);
    console.log("Cost for 1 token:", cost1);

    // Buy 1 token
    const hash1 = await token.write.buyToken([amount1]);

    // Check ERC20 balance changes
    await viem.assertions.erc20BalancesHaveChanged(hash1, mockERC20.address, [
      { address: buyerAddress, amount: -cost1 },
      { address: token.address, amount: cost1 },
    ]);

    // Check token balance
    const balance1 = await token.read.balanceOf([buyerAddress]);
    assert.equal(balance1, amount1, "Should have 1 token");

    // Get cost for 2 more tokens (tokenSold is now 1)
    const amount2 = parseUnits("2", 18);
    const cost2 = await token.read.getCost([amount1, amount2]);
    console.log("Cost for 2 more tokens:", cost2);

    // Buy 2 more tokens
    const hash2 = await token.write.buyToken([amount2]);

    // Check ERC20 balance changes
    await viem.assertions.erc20BalancesHaveChanged(hash2, mockERC20.address, [
      { address: buyerAddress, amount: -cost2 },
      { address: token.address, amount: cost2 },
    ]);

    // Check final token balance
    const finalBalance = await token.read.balanceOf([buyerAddress]);
    assert.equal(finalBalance, amount1 + amount2, "Should have 3 tokens");

    // Verify tokenSold
    const tokenSold = await token.read.tokenSold();
    assert.equal(tokenSold, amount1 + amount2, "tokenSold should be 3");
  });

  it("Should emit TokenBought event", async function () {
    const { token, mockERC20, deployer, viem } = await deployContracts();
    const buyerAddress = getAddress(deployer.account.address);

    // Approve
    await mockERC20.write.approve([token.address, parseUnits("10000", 18)]);

    const amount = parseUnits("1", 18);
    const cost = await token.read.getCost([0n, amount]);

    // Buy and check event
    await viem.assertions.emitWithArgs(
      token.write.buyToken([amount]),
      token,
      "TokenBought",
      [buyerAddress, amount, cost]
    );
  });

  it("Should verify cost consistency: buy 1 + buy 2 = buy 3", async function () {
    const { token } = await deployContracts();

    const cost1 = await token.read.getCost([0n, parseUnits("1", 18)]);
    const cost2 = await token.read.getCost([parseUnits("1", 18), parseUnits("2", 18)]);
    const cost3 = await token.read.getCost([0n, parseUnits("3", 18)]);

    console.log("Cost 1 token:", cost1);
    console.log("Cost 2 tokens (after 1):", cost2);
    console.log("Cost 3 tokens at once:", cost3);

    assert.equal(cost1 + cost2, cost3, "Buying 1 then 2 should cost same as 3 at once");
  });
});
