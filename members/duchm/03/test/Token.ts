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
    const name = await token.read.name(); // Corrected: Await the name() call
    assert.equal(name, "Duchm", "Token should have correct name");
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
    assert.equal(tokenSold, 10n, "Should have sold 10 tokens");

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
