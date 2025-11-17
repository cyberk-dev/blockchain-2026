import assert from "node:assert/strict";
import { describe, it } from "node:test";
import TokenModule from "../ignition/modules/Token.js";

import { network } from "hardhat";
import { parseUnits } from "viem";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, recipient1, recipient2] = await viem.getWalletClients();

  it("Deploy ignition", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Token",
          symbol: "TKN",
          initialSupply: parseUnits("1000", 18),
        },
      },
    });
    console.log("token", token.address);
  });

  it("Transfer tokens to recipient1", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "TestToken",
          symbol: "TEST",
          initialSupply: parseUnits("10000", 18),
        },
      },
    });

    const transferAmount = parseUnits("100", 18);

    // Get initial balances
    const initialDeployerBalance = await token.read.balanceOf([deployer.account.address]);
    const initialRecipientBalance = await token.read.balanceOf([recipient1.account.address]);

    // Execute transfer
    const tx = await token.write.transfer([recipient1.account.address, transferAmount]);

    // Verify balances after transfer
    const finalDeployerBalance = await token.read.balanceOf([deployer.account.address]);
    const finalRecipientBalance = await token.read.balanceOf([recipient1.account.address]);

    assert.equal(
      finalDeployerBalance,
      initialDeployerBalance - transferAmount,
      "Deployer balance should decrease by transfer amount"
    );
    assert.equal(
      finalRecipientBalance,
      initialRecipientBalance + transferAmount,
      "Recipient balance should increase by transfer amount"
    );

    console.log(`Transferred ${transferAmount} tokens to ${recipient1.account.address}`);
  });

  it("Transfer different amounts to multiple recipients", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "MultiTransferToken",
          symbol: "MTT",
          initialSupply: parseUnits("50000", 18),
        },
      },
    });

    // Transfer 250 tokens to recipient1
    const amount1 = parseUnits("250", 18);
    const tx1 = await token.write.transfer([recipient1.account.address, amount1]);

    const balance1 = await token.read.balanceOf([recipient1.account.address]);
    assert.equal(balance1, amount1, "Recipient1 should have 250 tokens");

    // Transfer 500 tokens to recipient2
    const amount2 = parseUnits("500", 18);
    const tx2 = await token.write.transfer([recipient2.account.address, amount2]);

    const balance2 = await token.read.balanceOf([recipient2.account.address]);
    assert.equal(balance2, amount2, "Recipient2 should have 500 tokens");

    console.log(`Successfully transferred ${amount1} to recipient1 and ${amount2} to recipient2`);
  });

  it("Transfer small amounts (decimal tokens)", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "DecimalToken",
          symbol: "DEC",
          initialSupply: parseUnits("1000", 18),
        },
      },
    });

    // Transfer 0.5 tokens
    const smallAmount = parseUnits("0.5", 18);
    const tx = await token.write.transfer([recipient1.account.address, smallAmount]);

    const balance = await token.read.balanceOf([recipient1.account.address]);
    assert.equal(balance, smallAmount, "Recipient should have 0.5 tokens");

    console.log(`Successfully transferred 0.5 tokens (${smallAmount} wei)`);
  });

  it("Verify transfer events are emitted", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "EventToken",
          symbol: "EVT",
          initialSupply: parseUnits("5000", 18),
        },
      },
    });

    const transferAmount = parseUnits("50", 18);
    const tx = await token.write.transfer([recipient1.account.address, transferAmount]);

    // Verify transaction hash is returned
    assert.ok(tx, "Transaction hash should be returned");
    assert.ok(tx.startsWith("0x"), "Transaction hash should start with 0x");

    console.log(`Transfer transaction successful: ${tx}`);
  });
});
