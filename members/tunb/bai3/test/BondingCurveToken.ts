import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, parseEther } from "viem";

describe("BondingCurveToken", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Test parameters
  const TOKEN_NAME = "Test Bonding Token";
  const TOKEN_SYMBOL = "TBT";
  const A = 1000n; // Price increment per token (in wei)
  const B = 1000000n; // Base price (in wei)
  const INITIAL_SUPPLY = 100n; // 100 tokens (raw amount, contract will mint as-is)

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      assert.equal(await token.read.name(), TOKEN_NAME);
      assert.equal(await token.read.symbol(), TOKEN_SYMBOL);
    });

    it("Should set immutable values a and b correctly", async function () {
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      assert.equal(await token.read.a(), A);
      assert.equal(await token.read.b(), B);
    });

    it("Should mint initial supply to deployer", async function () {
      const [deployer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      // Contract mints initialSupply directly without decimals adjustment
      const balance = await token.read.balanceOf([deployer.account.address]);

      assert.equal(balance, INITIAL_SUPPLY);
    });

    it("Should initialize totalSold to 0", async function () {
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      assert.equal(await token.read.totalSold(), 0n);
    });
  });

  describe("Token Purchase", function () {
    it("Should successfully purchase tokens with exact payment", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      const amountToBuy = 5n;
      const cost = await token.read.calculateCost([amountToBuy]);

      await token.write.buyTokens([amountToBuy], {
        value: cost,
        account: buyer.account,
      });

      const decimals = await token.read.decimals();
      const expectedBalance = amountToBuy * 10n ** BigInt(decimals);
      const balance = await token.read.balanceOf([buyer.account.address]);

      assert.equal(balance, expectedBalance);
    });

    it("Should update totalSold after purchase", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      const amountToBuy = 7n;
      const cost = await token.read.calculateCost([amountToBuy]);

      await token.write.buyTokens([amountToBuy], {
        value: cost,
        account: buyer.account,
      });

      const totalSold = await token.read.totalSold();
      assert.equal(totalSold, amountToBuy);
    });

    it("Should emit TokensPurchased event", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      const amountToBuy = 3n;
      const cost = await token.read.calculateCost([amountToBuy]);

      await viem.assertions.emitWithArgs(
        token.write.buyTokens([amountToBuy], {
          value: cost,
          account: buyer.account,
        }),
        token,
        "TokensPurchased",
        [getAddress(buyer.account.address), amountToBuy, cost]
      );
    });

    it("Should refund excess payment", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      const amountToBuy = 5n;
      const cost = await token.read.calculateCost([amountToBuy]);
      const overpayment = parseEther("1"); // Send 1 ETH extra

      const balanceBefore = await publicClient.getBalance({
        address: buyer.account.address,
      });

      const hash = await token.write.buyTokens([amountToBuy], {
        value: cost + overpayment,
        account: buyer.account,
      });

      const receipt = await publicClient.getTransactionReceipt({ hash });
      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;

      const balanceAfter = await publicClient.getBalance({
        address: buyer.account.address,
      });

      // Balance should decrease by: cost + gas fees only (overpayment refunded)
      const expectedDecrease = cost + gasUsed;
      const actualDecrease = balanceBefore - balanceAfter;

      assert.equal(actualDecrease, expectedDecrease);
    });

    it("Should handle multiple sequential purchases", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      // First purchase
      const firstAmount = 3n;
      const firstCost = await token.read.calculateCost([firstAmount]);
      await token.write.buyTokens([firstAmount], {
        value: firstCost,
        account: buyer.account,
      });

      // Second purchase
      const secondAmount = 4n;
      const secondCost = await token.read.calculateCost([secondAmount]);
      await token.write.buyTokens([secondAmount], {
        value: secondCost,
        account: buyer.account,
      });

      const totalSold = await token.read.totalSold();
      assert.equal(totalSold, firstAmount + secondAmount);

      const decimals = await token.read.decimals();
      const expectedBalance =
        (firstAmount + secondAmount) * 10n ** BigInt(decimals);
      const balance = await token.read.balanceOf([buyer.account.address]);
      assert.equal(balance, expectedBalance);
    });
  });

  describe("Error Handling", function () {
    it("Should revert when buying 0 tokens", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      await assert.rejects(
        async () => {
          await token.write.buyTokens([0n], {
            value: 1000n,
            account: buyer.account,
          });
        },
        {
          name: "ContractFunctionExecutionError",
        }
      );
    });

    it("Should revert when payment is insufficient", async function () {
      const [, buyer] = await viem.getWalletClients();
      const token = await viem.deployContract("BondingCurveToken", [
        TOKEN_NAME,
        TOKEN_SYMBOL,
        A,
        B,
        INITIAL_SUPPLY,
      ]);

      const amountToBuy = 5n;
      const cost = await token.read.calculateCost([amountToBuy]);
      const insufficientPayment = cost - 1n;

      await assert.rejects(
        async () => {
          await token.write.buyTokens([amountToBuy], {
            value: insufficientPayment,
            account: buyer.account,
          });
        },
        {
          name: "ContractFunctionExecutionError",
        }
      );
    });
  });
});
