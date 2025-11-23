import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { formatUnits, parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import UsdtModule from "../ignition/modules/Usdt.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition, } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1] = await viem.getWalletClients();

  // Deploy USDT first
  const { usdt } = await ignition.deploy(UsdtModule);

  // Deploy Token with USDT address
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        usdtAddress: usdt.address,
      },
    }
  })



  return { viem, ignition, publicClient, token, usdt, deployer };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token, usdt } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    console.log("usdt", usdt.address);
    console.log("token", token.address);
  });

});

describe("Token Price", async function () {

  describe("Price slope 1e24, intercept 1", async function () {
    it("Should return correct price for first token", async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

      const [account] = await viem.getWalletClients();

      const slope = parseUnits('1', 24);
      const intercept = BigInt("1");
      await token.write.setSlopeAndIntercept([slope, intercept]);

      const amount = parseUnits("1", 18); // 1 token
      const price = await token.read.getBuyPrice([amount]);

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e24%5D+%2B+1%2C%7Bx%2C1%2C1e18%7D%5D
      const expectedPrice = BigInt("1000000500000000001");
      assert.equal(price, expectedPrice, `Expected price ${expectedPrice}, got ${price}`);
    });

    it("Should return correct price for first 1.5 token and first 2.5 token", async function () {
      const { networkHelpers } = await network.connect();
      const { viem, token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

      const [account] = await viem.getWalletClients();

      const slope = parseUnits('1', 24);
      const intercept = BigInt("1");
      await token.write.setSlopeAndIntercept([slope, intercept]);

      const amount = parseUnits("1.5", 18); // 1 token
      const price = await token.read.getBuyPrice([amount]);

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e24%5D+%2B+1%2C%7Bx%2C1%2C1e18%2B5e17%7D%5D
      const expectedPrice = BigInt('1500001125000000001');
      assert.equal(price, expectedPrice, `Expected price ${expectedPrice}, got ${price}`);


      const amount2 = parseUnits("2.5", 18); // 2.5 token
      const price2 = await token.read.getBuyPrice([amount2]);

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e24%5D+%2B+1%2C%7Bx%2C1%2C2e18%2B5e17%7D%5D
      const expectedPrice2 = BigInt('2500003125000000001');
      assert.equal(price2, expectedPrice2, `Expected price ${expectedPrice2}, got ${price2}`);
    });

    it('Should buy first token success and balance changes', async () => {
      const { networkHelpers } = await network.connect();
      const { viem, token, usdt, deployer } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));


      const slope = parseUnits('1', 24);
      const intercept = BigInt("1");
      await token.write.setSlopeAndIntercept([slope, intercept]);

      const amount = parseUnits("1", 18); // 1 token
      const price = await token.read.getBuyPrice([amount]);

      // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e24%5D+%2B+1%2C%7Bx%2C1%2C1e18%7D%5D
      const expectedPrice = BigInt("1000000500000000001");
      assert.equal(price, expectedPrice, `Expected price ${expectedPrice}, got ${price}`);


      // mint
      await usdt.write.mint([deployer.account.address, price]);

      const approveTx = await usdt.write.approve([
        token.address,
        price,
      ]);
      assert.ok(approveTx, "USDT approval transaction should succeed");

      const txn = token.write.buyToken([amount]);

      assert.ok(txn, "First token purchase transaction should succeed");
      await viem.assertions.erc20BalancesHaveChanged(txn, usdt.address, [
        { address: deployer.account.address, amount: -price },
        { address: token.address, amount: price },
      ]);
    });
  });


});