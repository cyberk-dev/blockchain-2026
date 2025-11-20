import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("100000000", 18),
      },
    }
  })

  return { viem, ignition, publicClient, token };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    
    console.log("token", token.address);
  });

  it("Should have correct token information", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const name = await token.read.name();
    const symbol = await token.read.symbol();
    const decimals = await token.read.decimals();

    assert.equal(name, "Cyberk", "Token name should be Cyberk");
    assert.equal(symbol, "CBK", "Token symbol should be CBK");
    assert.equal(decimals, 18, "Token decimals should be 18");
  });

  it("Should have correct initial supply", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [owner] = await viem.getWalletClients();

    const totalSupply = await token.read.totalSupply();
    const ownerBalance = await token.read.balanceOf([owner.account.address]);

    assert.equal(totalSupply, parseUnits("100000000", 18), "Total supply should be 100,000,000");
    assert.equal(ownerBalance, parseUnits("100000000", 18), "Owner should have all initial supply");
  });

  it("Should have correct initial price", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const price = await token.read.price();
    assert.equal(price, parseUnits("0.1", 18), "Initial price should be 0.1 ETH");
  });

  it("Should allow owner to set price", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    const newPrice = parseUnits("0.2", 18);
    await token.write.setPrice([newPrice]);

    const price = await token.read.price();
    assert.equal(price, newPrice, "Price should be updated to 0.2 ETH");
  });

  it("Should not allow non-owner to set price", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, user] = await viem.getWalletClients();

    const newPrice = parseUnits("0.2", 18);
    
    await assert.rejects(
      async () => {
        await token.write.setPrice([newPrice], { account: user.account });
      },
      /OwnableUnauthorizedAccount/,
      "Should revert with OwnableUnauthorizedAccount error"
    );
  });

  it("Buy token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    await token.write.buyToken([parseUnits("1", 18)], { 
      value: parseUnits("0.1", 18), // 0.1 eth
    });
  });

  it("Should mint correct amount of tokens when buying", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("10", 18);
    const balanceBefore = await token.read.balanceOf([buyer.account.address]);

    await token.write.buyToken([amountToBuy], {
      value: parseUnits("1", 18), // 1 ETH (enough for 10 tokens at 0.1 ETH each)
      account: buyer.account,
    });

    const balanceAfter = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balanceAfter - balanceBefore, amountToBuy, "Should receive correct amount of tokens");
  });

  it("Should revert when buying with insufficient funds", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("10", 18);
    
    await assert.rejects(
      async () => {
        await token.write.buyToken([amountToBuy], {
          value: parseUnits("0.5", 18), // Only 0.5 ETH, not enough for 10 tokens
          account: buyer.account,
        });
      },
      /InsufficientFunds/,
      "Should revert with InsufficientFunds error"
    );
  });

  it("Should revert when buying zero tokens", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    await assert.rejects(
      async () => {
        await token.write.buyToken([0n], {
          value: parseUnits("0.1", 18),
          account: buyer.account,
        });
      },
      /InvalidAmount/,
      "Should revert with InvalidAmount error"
    );
  });

  it("Should allow buying exact amount with exact payment", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const amountToBuy = parseUnits("5", 18);
    const exactPayment = parseUnits("0.5", 18); // 5 tokens * 0.1 ETH

    const balanceBefore = await token.read.balanceOf([buyer.account.address]);

    await token.write.buyToken([amountToBuy], {
      value: exactPayment,
      account: buyer.account,
    });

    const balanceAfter = await token.read.balanceOf([buyer.account.address]);
    assert.equal(balanceAfter - balanceBefore, amountToBuy, "Should receive exact amount of tokens");
  });

  it("Should handle multiple purchases from same buyer", async function () {
    const { networkHelpers, viem } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    const [, buyer] = await viem.getWalletClients();

    const firstPurchase = parseUnits("5", 18);
    const secondPurchase = parseUnits("3", 18);

    await token.write.buyToken([firstPurchase], {
      value: parseUnits("0.5", 18),
      account: buyer.account,
    });

    await token.write.buyToken([secondPurchase], {
      value: parseUnits("0.3", 18),
      account: buyer.account,
    });

    const finalBalance = await token.read.balanceOf([buyer.account.address]);
    assert.equal(finalBalance, firstPurchase + secondPurchase, "Should accumulate tokens from multiple purchases");
  });
});