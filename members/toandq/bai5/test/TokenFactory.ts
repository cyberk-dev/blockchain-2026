import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { Address, decodeEventLog, parseEther, parseUnits } from "viem";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

describe("TokenFactory", async function () {
  const { viem, ignition, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const { loadFixture } = networkHelpers;

  async function deployFactoryFixture() {
    const [owner, addr1, addr2] = await viem.getWalletClients();

    const deployed = await ignition.deploy(TokenFactoryModule);
    const { factory, tokenBeacon, factoryProxy, proxyAdmin } = deployed;

    return {
      factory,
      tokenBeacon,
      factoryProxy,
      proxyAdmin,
      owner,
      addr1,
      addr2,
      publicClient,
    };
  }

  it("Should deploy factory with beacon successfully", async function () {
    const { factory, tokenBeacon, factoryProxy } = await loadFixture(
      deployFactoryFixture
    );

    assert.ok(factory.address, "Factory should have an address");
    assert.ok(tokenBeacon.address, "Token beacon should have an address");
    assert.ok(factoryProxy.address, "Factory proxy should have an address");

    // Verify version
    const version = await factory.read.version();
    assert.equal(version, 1n, "Version should be 1");

    // Verify factory can create tokens (indirectly verifies beacon is set)
    const fee = parseEther("0.0001");
    const hash = await factory.write.createToken(["Test", "TST"], {
      value: fee,
    });
    assert.ok(hash, "Factory should be able to create tokens");
  });

  it("Should create token successfully with correct fee", async function () {
    const { factory, owner, publicClient } = await loadFixture(
      deployFactoryFixture
    );

    const tokenName = "Test Token";
    const tokenSymbol = "TT";
    const fee = await factory.read.fee();

    const hash = await factory.write.createToken([tokenName, tokenSymbol], {
      account: owner.account,
      value: fee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find TokensPurchased event
    const tokensPurchasedLog = receipt.logs.find((log) => {
      try {
        const decoded = decodeEventLog({
          abi: factory.abi,
          data: log.data,
          topics: log.topics,
        });
        return decoded.eventName === "TokensPurchased";
      } catch {
        return false;
      }
    });

    assert.ok(tokensPurchasedLog, "TokensPurchased event should be emitted");

    const decoded = decodeEventLog({
      abi: factory.abi,
      data: tokensPurchasedLog!.data,
      topics: tokensPurchasedLog!.topics,
    });

    const { tokenAddress, owner: tokenOwner, name, symbol } =
      decoded.args as any;

    assert.ok(tokenAddress, "Token address should not be zero");
    assert.equal(
      tokenOwner.toLowerCase(),
      owner.account.address.toLowerCase(),
      "Token owner should match creator"
    );
    assert.equal(name, tokenName, "Token name should match");
    assert.equal(symbol, tokenSymbol, "Token symbol should match");

    // Verify token exists in factory
    const exists = await factory.read.exists([tokenAddress]);
    assert.equal(exists, true, "Token should exist in factory");

    // Verify token properties
    const tokenContract = await viem.getContractAt("Token", tokenAddress);
    const tokenNameRead = await tokenContract.read.name();
    const tokenSymbolRead = await tokenContract.read.symbol();
    const tokenOwnerRead = await tokenContract.read.owner();

    assert.equal(tokenNameRead, tokenName, "Token name should match");
    assert.equal(tokenSymbolRead, tokenSymbol, "Token symbol should match");
    assert.equal(
      tokenOwnerRead.toLowerCase(),
      owner.account.address.toLowerCase(),
      "Token owner should match creator"
    );
  });

  it("Should revert when creating token with insufficient fee", async function () {
    const { factory, owner } = await loadFixture(deployFactoryFixture);

    const tokenName = "Test Token";
    const tokenSymbol = "TT";
    const fee = await factory.read.fee();
    const insufficientFee = fee - 1n; // Less than required fee

    await assert.rejects(
      async () => {
        await factory.write.createToken([tokenName, tokenSymbol], {
          account: owner.account,
          value: insufficientFee,
        });
      },
      (error: any) => {
        return (
          error.message?.includes("InsufficientFee") ||
          error.message?.includes("revert") ||
          error.message?.includes("execution reverted")
        );
      },
      "Should revert with InsufficientFee error"
    );
  });

  it("Should allow owner to set fee", async function () {
    const { factory, owner } = await loadFixture(deployFactoryFixture);

    const newFee = parseEther("0.0002");
    await factory.write.setFee([newFee], {
      account: owner.account,
    });

    const fee = await factory.read.fee();
    assert.equal(fee, newFee, "Fee should be updated");
  });

  it("Should allow owner to set fee recipient", async function () {
    const { factory, owner, addr1 } = await loadFixture(deployFactoryFixture);

    await factory.write.setFeeRecipient([addr1.account.address], {
      account: owner.account,
    });

    const fee_recipient = await factory.read.fee_recipient();
    assert.equal(
      fee_recipient.toLowerCase(),
      addr1.account.address.toLowerCase(),
      "Fee recipient should be updated"
    );
  });

  it("Should revert when non-owner tries to set fee", async function () {
    const { factory, addr1 } = await loadFixture(deployFactoryFixture);

    const newFee = parseEther("0.0002");

    await assert.rejects(
      async () => {
        await factory.write.setFee([newFee], {
          account: addr1.account,
        });
      },
      (error: any) => {
        return (
          error.message?.includes("OwnableUnauthorizedAccount") ||
          error.message?.includes("revert") ||
          error.message?.includes("execution reverted")
        );
      },
      "Should revert when non-owner tries to set fee"
    );
  });

  it("Should allow owner to set recipient fee BPS", async function () {
    const { factory, owner } = await loadFixture(deployFactoryFixture);

    const newRecipientFeeBps = 100n; // 1%
    await factory.write.setRecipientFeeBps([newRecipientFeeBps], {
      account: owner.account,
    });

    const recipient_fee_bps = await factory.read.recipient_fee_bps();
    assert.equal(
      recipient_fee_bps,
      newRecipientFeeBps,
      "Recipient fee BPS should be updated"
    );
  });

  it("Should revert when setting recipient fee BPS exceeds 10000", async function () {
    const { factory, owner } = await loadFixture(deployFactoryFixture);

    const invalidBps = 10001n; // Exceeds 10000

    await assert.rejects(
      async () => {
        await factory.write.setRecipientFeeBps([invalidBps], {
          account: owner.account,
        });
      },
      (error: any) => {
        return (
          error.message?.includes("BPS cannot exceed 10000") ||
          error.message?.includes("revert") ||
          error.message?.includes("execution reverted")
        );
      },
      "Should revert when BPS exceeds 10000"
    );
  });

  it("Should transfer BPS fee to fee recipient when creating token", async function () {
    const { factory, owner, addr1 } = await loadFixture(deployFactoryFixture);

    // Set fee recipient to addr1
    await factory.write.setFeeRecipient([addr1.account.address], {
      account: owner.account,
    });

    // Set recipient fee BPS to 100 (1%)
    await factory.write.setRecipientFeeBps([100n], {
      account: owner.account,
    });

    const paymentAmount = parseEther("0.001"); // 0.001 ETH
    const expectedBpsFee = (paymentAmount * 100n) / 10000n; // 1% = 0.0001 ETH

    const hashPromise = factory.write.createToken(["Fee Token", "FEE"], {
      account: owner.account,
      value: paymentAmount,
    });

    await viem.assertions.balancesHaveChanged(hashPromise, [
      {
        address: addr1.account.address,
        amount: expectedBpsFee,
      },
    ]);
  });

  it("Should not transfer BPS fee when recipient_fee_bps is 0", async function () {
    const { factory, owner, addr1, publicClient } = await loadFixture(
      deployFactoryFixture
    );

    // Set fee recipient to addr1
    await factory.write.setFeeRecipient([addr1.account.address], {
      account: owner.account,
    });

    // Ensure recipient_fee_bps is 0 (default)
    const recipient_fee_bps = await factory.read.recipient_fee_bps();
    assert.equal(recipient_fee_bps, 0n, "Recipient fee BPS should be 0");

    const paymentAmount = parseEther("0.001");
    const balanceBefore = await publicClient.getBalance({
      address: addr1.account.address,
    });

    const hash = await factory.write.createToken(["Fee Token", "FEE"], {
      account: owner.account,
      value: paymentAmount,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    const balanceAfter = await publicClient.getBalance({
      address: addr1.account.address,
    });

    // Balance should not change when recipient_fee_bps is 0
    assert.equal(
      balanceAfter,
      balanceBefore,
      "Fee recipient balance should not change when BPS is 0"
    );
  });

  it.skip("Should upgrade successfully", async function () {
    // TODO: Implement upgrade test
  });
});
