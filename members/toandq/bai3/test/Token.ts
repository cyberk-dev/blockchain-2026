import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition, } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Set endTime to 30 days from now (in seconds)
  const endTime = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("100000000", 18),
        endTime: endTime,
      },
    }
  })

  return { viem, ignition, publicClient, token, };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    console.log("token", token.address);
  });

  it("Buy token", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    await token.write.buyToken([1000000000000000000n], {
      value: 100000000000000000n, // 0.1 eth
    });
  });

  it("Cannot buy token after endTime", async function () {
    const { networkHelpers } = await network.connect();

    const { token, } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));


    const contractEndTime = await token.read.endTime();


    // Time travel to after endTime
    await networkHelpers.time.increaseTo(contractEndTime + 1n);

    // Try to buy token after endTime - should fail
    try {
      await token.write.buyToken([1000000000000000000n], {
        value: 100000000000000000n, // 0.1 eth
      });
      assert.fail("buyToken should have reverted with EndTimeReached error");
    } catch (error: any) {
      assert.ok(
        error.message.includes("EndTimeReached") ||
        error.message.includes("revert"),
        `Expected EndTimeReached error, got: ${error.message}`
      );
    }
  });
});