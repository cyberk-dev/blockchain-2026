import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const blockNumber = await publicClient.getBlockNumber();
  const block = await publicClient.getBlock({ blockNumber });
  const now = Number(block.timestamp);
  const endTimeFuture = now + 3600;
  
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Cyberk",
        symbol: "CBK",
        initialSupply: parseUnits("100000000", 18),
        endTime: BigInt(endTimeFuture)
      },
    }
  })

  return { viem, ignition, publicClient, token };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const now = Math.floor(Date.now() / 1000);
    const endTimeFuture = now + 3600;

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
  it("Buy token before sale ends", async function () {
    const { networkHelpers } = await network.connect();
    const { token } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    await token.write.buyToken([parseUnits("1", 18)], {
      value: parseUnits("0.1", 18), // 0.1 ETH
    });
  });

  it("Buy token after sale ended should fail", async function () {
    const { viem, ignition, networkHelpers } = await network.connect();
    const publicClient = await viem.getPublicClient();

    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    const now = Number(block.timestamp);
    const endTimeFuture = now + 3600;
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Cyberk",
          symbol: "CBK",
          initialSupply: parseUnits("100000000", 18),
          endTime: BigInt(endTimeFuture)
        },
      }
    });
    
    await networkHelpers.time.increase(3601);

    let errorCaught = false;
    try {
      await token.write.buyToken([parseUnits("1", 18)], {
        value: parseUnits("0.1", 18),
      });
    } catch (e) {
      errorCaught = true;
    }
    assert(errorCaught, "Transaction should have failed after sale ended");
  });
});