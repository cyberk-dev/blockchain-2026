import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  let tokenAddress: `0x${string}`;
  const { viem, ignition, networkHelpers: helpers } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Should deploy token", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Duchm",
          symbol: "DCH",
        },
      },
    });
    tokenAddress = token.address;
    assert.ok(token.address, "Token should have an address");
    const name = await token.read.name();
    assert.equal(name, "Duchm", "Token should have correct name");
  });

  it("Should implement progressive pricing correctly", async function () {
    const [, buyer1, buyer2] = await viem.getWalletClients();

    const token = await viem.getContractAt("Token", tokenAddress);

    const initialTokenSold = await token.read.getTokenSold();
    assert.equal(initialTokenSold, 0n, "Initial tokenSold should be 0");

    const firstAmount = 10n;
    await token.write.buy([firstAmount], {
      value: parseEther("2"),
      account: buyer1.account,
    });

    let tokenSold = await token.read.getTokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount,
      "tokenSold should be 10 after first purchase"
    );

    const buyer1Balance = await token.read.balanceOf([buyer1.account.address]);
    assert.equal(
      buyer1Balance,
      firstAmount * parseUnits("1", 18),
      "Buyer1 should have 10 tokens"
    );

    const secondAmount = 5n;
    await token.write.buy([secondAmount], {
      value: parseEther("2"),
      account: buyer2.account,
    });

    tokenSold = await token.read.getTokenSold();
    assert.equal(
      tokenSold,
      initialTokenSold + firstAmount + secondAmount,
      "tokenSold should be 15 after second purchase"
    );

    const buyer2Balance = await token.read.balanceOf([buyer2.account.address]);
    assert.equal(
      buyer2Balance,
      secondAmount * parseUnits("1", 18),
      "Buyer2 should have 5 tokens"
    );
  });

  it("Should have time limit for purchase", async function () {
    const [, buyer] = await viem.getWalletClients();

    const token = await viem.getContractAt("Token", tokenAddress);

    const tx = await token.write.buy([10n], {
      value: parseEther("2"),
      account: buyer.account,
    });
    await publicClient.waitForTransactionReceipt({
      hash: tx,
    });

    const tokenSold = await token.read.getTokenSold();
    assert.equal(tokenSold, 25n, "Should have sold 25 tokens");

    await helpers.time.increase(3601);

    await assert.rejects(
      async () => {
        await token.write.buy([10n], {
          value: parseEther("2"),
        });
      },
      (error: any) => {
        const message = error.message || error.shortMessage || "";
        return message.includes("PurchasePeriodEnded");
      },
      "Should revert with PurchasePeriodEnded error"
    );
  });
});
