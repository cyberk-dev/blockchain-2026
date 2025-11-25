import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseUnits, getContract, zeroAddress, formatUnits } from "viem";

import { network } from "hardhat";
import { tokenLinearFixture, TokenLinearFixtureType } from "./fixture.js";
import { NetworkConnection } from "hardhat/types/network";
import { extractEvent } from "./utils.js";

async function deploy(this: NetworkConnection) {
  return await tokenLinearFixture(this);
}

describe("TokenLinear", async function () {
  let fixture: TokenLinearFixtureType;

  beforeEach(async function () {
    const connection = await network.connect();
    fixture = await connection.networkHelpers.loadFixture(
      deploy.bind(connection)
    );
  });

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const { tokenLinear } = fixture;

      const name = await tokenLinear.read.name();
      const symbol = await tokenLinear.read.symbol();

      assert.equal(name, "Linear Token", "Token name should match");
      assert.equal(symbol, "LIN", "Token symbol should match");
    });

    it("Should set correct owner", async function () {
      const { tokenLinear, users } = fixture;

      const owner = (await tokenLinear.read.owner()) as string;
      assert.equal(
        owner.toLowerCase(),
        users.deployer.account.address.toLowerCase(),
        "Owner should be deployer"
      );
    });

    it("Should set correct initial parameters", async function () {
      const { tokenLinear, slope, intercept, feeToken } = fixture;

      const actualSlope = await tokenLinear.read.slope();
      const actualIntercept = await tokenLinear.read.intercept();
      const feeAddress = (await tokenLinear.read.fee()) as string;

      assert.equal(actualSlope, slope, "Slope should match");
      assert.equal(actualIntercept, intercept, "Intercept should match");
      assert.equal(
        feeAddress.toLowerCase(),
        feeToken.address.toLowerCase(),
        "Fee token should match"
      );
    });

    it("Should have zero initial supply", async function () {
      const { tokenLinear } = fixture;

      const totalSupply = await tokenLinear.read.totalSupply();
      assert.equal(totalSupply, 0n, "Initial supply should be zero");
    });
  });

  describe("setParameters", function () {
    it("Should allow owner to set parameters", async function () {
      const { tokenLinear } = fixture;

      const newSlope = 2n;
      const newIntercept = parseUnits("5", 10);

      await tokenLinear.write.setParameters([newSlope, newIntercept]);

      const actualSlope = await tokenLinear.read.slope();
      const actualIntercept = await tokenLinear.read.intercept();

      assert.equal(actualSlope, newSlope, "Slope should be updated");
      assert.equal(
        actualIntercept,
        newIntercept,
        "Intercept should be updated"
      );
    });

    it("Should reject non-owner from setting parameters", async function () {
      const { tokenLinear, users } = fixture;

      const tokenLinearAsUser = getContract({
        address: tokenLinear.address,
        abi: tokenLinear.abi,
        client: users.user1,
      });

      const newSlope = 2n;
      const newIntercept = parseUnits("5", 10);

      try {
        await tokenLinearAsUser.write.setParameters([newSlope, newIntercept]);
        assert.fail("Should have thrown an error for non-owner");
      } catch (error: any) {
        assert.ok(
          error.message.includes("OwnableUnauthorizedAccount") ||
            error.message.includes("revert") ||
            error.message.includes("execution reverted"),
          "Should revert with ownership error"
        );
      }
    });
  });

  describe("setFeeToken", function () {
    it("Should allow owner to set fee token", async function () {
      const { tokenLinear, viem } = fixture;

      // Deploy a new mock token
      const newFeeToken = await viem.deployContract(
        "contracts/Token.sol:Token",
        ["New Fee Token", "NFEE", parseUnits("1000000", 18)]
      );

      await tokenLinear.write.setFeeToken([newFeeToken.address]);

      const feeAddress = (await tokenLinear.read.fee()) as string;
      assert.equal(
        feeAddress.toLowerCase(),
        newFeeToken.address.toLowerCase(),
        "Fee token should be updated"
      );
    });

    it("Should reject non-owner from setting fee token", async function () {
      const { tokenLinear, users } = fixture;

      const tokenLinearAsUser = getContract({
        address: tokenLinear.address,
        abi: tokenLinear.abi,
        client: users.user1,
      });

      try {
        await tokenLinearAsUser.write.setFeeToken([zeroAddress]);
        assert.fail("Should have thrown an error for non-owner");
      } catch (error: any) {
        assert.ok(
          error.message.includes("OwnableUnauthorizedAccount") ||
            error.message.includes("revert") ||
            error.message.includes("execution reverted"),
          "Should revert with ownership error"
        );
      }
    });
  });

  describe("getCost", function () {
    //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D
    it("Should calculate cost correctly for first token purchase", async function () {
      const { tokenLinear, slope, intercept } = fixture;

      const supply = 0n;
      const amount = parseUnits("1", 18);

      const actualCost = await tokenLinear.read.getCost([
        supply,
        amount,
        slope,
        intercept,
      ]);

      const expectedCost = BigInt(5e13);
      assert.equal(actualCost, expectedCost, "Cost calculation should match");
    });

    //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1+%2B+1e18%2C1e18+%2B+10*1e18%7D%5D
    it("Should calculate cost correctly for next 10 tokens purchase", async function () {
      const { tokenLinear, slope, intercept } = fixture;

      const supply = parseUnits("1", 18);
      const amount = parseUnits("10", 18);

      const actualCost = await tokenLinear.read.getCost([
        supply,
        amount,
        slope,
        intercept,
      ]);
      const expectedCost = BigInt(6e15);
      assert.equal(actualCost, expectedCost, "Cost calculation should match");
    });
  });

  describe("buyTokens", function () {
    it("Should buy first token success", async function () {
      const { tokenLinear, feeToken, users, viem, connection } = fixture;

      const supply = 0n;
      const amount = parseUnits("1", 18);
      await feeToken.write.approve(
        [tokenLinear.address, parseUnits("100000000", 18)],
        {
          account: users.user1.account,
        }
      );

      const buyTokenTxn = tokenLinear.write.buyTokens([amount], {
        account: users.user1.account,
      });

      const expectedCost = BigInt(5e13);

      await viem.assertions.erc20BalancesHaveChanged(
        buyTokenTxn,
        feeToken.address,
        [
          { address: users.user1.account.address, amount: -expectedCost },
          { address: tokenLinear.address, amount: expectedCost },
        ]
      );

      await viem.assertions.emit(buyTokenTxn, tokenLinear, "TokenBought");

      const tokenBoughtEvent = await extractEvent(
        connection,
        tokenLinear,
        await buyTokenTxn,
        "TokenBought"
      );
      assert.ok(tokenBoughtEvent, "TokenBought event should be emitted");
    });
  });
});
