import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { network } from "hardhat";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import { parseEther, getAddress } from "viem";

describe("TokenFactory", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  let factory: any;
  let feeReceipt: string;
  const CREATION_FEE = parseEther("0.1"); // 0.1 ETH creation fee

  before(async function () {
    const [deployer, feeReceiver] = await viem.getWalletClients();
    feeReceipt = feeReceiver.account.address as `0x${string}`;

    // Deploy TokenFactory via Ignition
    const { factory: deployedFactory } = await ignition.deploy(TokenFactoryModule, {
      parameters: {
        TokenFactoryModule: {
          feeReceipt: feeReceipt,
          creationFee: CREATION_FEE,
        },
      },
    });
    factory = deployedFactory;
  });

  it("should deploy factory with correct fee receipt and creation fee", async function () {
    const factoryFeeReceipt = await factory.read.feeReceipt();
    const factoryCreationFee = await factory.read.creationFee();

    assert.equal(getAddress(factoryFeeReceipt), getAddress(feeReceipt), "Fee receipt should match");
    assert.equal(factoryCreationFee, CREATION_FEE, "Creation fee should match");
  });

  it("should create token with correct creation fee", async function () {
    const [creator] = await viem.getWalletClients();
    const creatorBalanceBefore = await publicClient.getBalance({ address: creator.account.address as `0x${string}` });
    const feeReceiptBalanceBefore = await publicClient.getBalance({ address: feeReceipt as `0x${string}` });

    const tx = await (factory.write as any).createToken(
      ["TestToken", "TEST", parseEther("100000"), 10n ** 22n, 1n],
      { account: creator.account, value: CREATION_FEE }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const creatorBalanceAfter = await publicClient.getBalance({ address: creator.account.address as `0x${string}` });
    const feeReceiptBalanceAfter = await publicClient.getBalance({ address: feeReceipt as `0x${string}` });

    // Creator should pay creation fee (plus gas)
    const creatorPaid = creatorBalanceBefore - creatorBalanceAfter;
    assert.ok(creatorPaid >= CREATION_FEE, "Creator should pay at least creation fee");

    // Fee receipt should receive creation fee
    const feeReceived = feeReceiptBalanceAfter - feeReceiptBalanceBefore;
    assert.equal(feeReceived, CREATION_FEE, "Fee receipt should receive creation fee");

    // Verify token was created
    const tokenCount = await factory.read.getDeployedTokensCount();
    assert.equal(tokenCount, 1n, "Should have 1 deployed token");
  });

  it("should revert if creation fee is insufficient", async function () {
    const [creator] = await viem.getWalletClients();
    const insufficientFee = CREATION_FEE - 1n;

    await assert.rejects(
      (factory.write as any).createToken(
        ["TestToken2", "TEST2", parseEther("100000"), 10n ** 22n, 1n],
        { account: creator.account, value: insufficientFee }
      ),
      (err: any) => {
        return err.message?.includes("InsufficientCreationFee") || err.message?.includes("insufficient");
      },
      "Should revert with insufficient creation fee"
    );
  });

  it("should refund excess ETH when creating token", async function () {
    const [creator] = await viem.getWalletClients();
    const excessAmount = parseEther("0.05"); // 0.05 ETH excess
    const totalSent = CREATION_FEE + excessAmount;
    const creatorBalanceBefore = await publicClient.getBalance({ address: creator.account.address as `0x${string}` });

    const tx = await (factory.write as any).createToken(
      ["TestToken3", "TEST3", parseEther("100000"), 10n ** 22n, 1n],
      { account: creator.account, value: totalSent }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    const creatorBalanceAfter = await publicClient.getBalance({ address: creator.account.address as `0x${string}` });

    // Creator should pay creation fee + gas, and receive excess back
    // So balance change should be approximately: creationFee + gasCost (excess is refunded)
    const balanceChange = creatorBalanceBefore - creatorBalanceAfter;
    const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
    
    // Balance change should be approximately creationFee + gasCost (excess was refunded)
    assert.ok(balanceChange >= CREATION_FEE + gasCost, "Should pay creation fee and gas");
    assert.ok(balanceChange < totalSent + gasCost, "Should not pay the excess amount");
  });

  it("should track token creator", async function () {
    const [creator] = await viem.getWalletClients();
    const tokenCount = await factory.read.getDeployedTokensCount();
    const lastTokenIndex = tokenCount - 1n;
    const allTokens = await factory.read.getAllDeployedTokens();
    const tokenAddress = allTokens[Number(lastTokenIndex)];

    const tokenCreator = await factory.read.getTokenCreator([tokenAddress]);
    assert.equal(getAddress(tokenCreator), getAddress(creator.account.address as `0x${string}`), "Token creator should match");
    
    const creatorTokens = await factory.read.getTokensByCreator([creator.account.address as `0x${string}`]);
    assert.ok(creatorTokens.length > 0, "Creator should have tokens");
    assert.ok(creatorTokens.includes(tokenAddress), "Creator tokens should include the token");
  });

  it("should allow owner to update fee receipt", async function () {
    const [owner, newFeeReceiver] = await viem.getWalletClients();
    const newFeeReceipt = newFeeReceiver.account.address as `0x${string}`;
    const oldFeeReceipt = await factory.read.feeReceipt();

    const tx = await (factory.write as any).setFeeReceipt([newFeeReceipt], { account: owner.account });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const updatedFeeReceipt = await factory.read.feeReceipt();
    assert.equal(getAddress(updatedFeeReceipt), getAddress(newFeeReceipt), "Fee receipt should be updated");
    
    // Restore for other tests
    await (factory.write as any).setFeeReceipt([oldFeeReceipt], { account: owner.account });
  });

  it("should allow owner to update creation fee", async function () {
    const [owner] = await viem.getWalletClients();
    const newFee = parseEther("0.2");
    const oldFee = await factory.read.creationFee();

    const tx = await (factory.write as any).setCreationFee([newFee], { account: owner.account });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const updatedFee = await factory.read.creationFee();
    assert.equal(updatedFee, newFee, "Creation fee should be updated");
    
    // Restore for other tests
    await (factory.write as any).setCreationFee([oldFee], { account: owner.account });
  });
});

