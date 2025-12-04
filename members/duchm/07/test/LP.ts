import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";
import LPModule from "../ignition/modules/LP.js";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = connection;
  const publicClient = await viem.getPublicClient();
  const [owner, buyer1, buyer2] = await viem.getWalletClients();
  const { lpFactory, token0, token1 } = await ignition.deploy(LPModule, {
    parameters: {}
  });

  return {
    viem,
    ignition,
    publicClient,
    lpFactory,
    owner,
    buyer1,
    buyer2,
    token1, token0,
  };
}

async function setup() {
  const { networkHelpers } = await network.connect();
  const ctx = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
  return ctx;
}

describe("TokenFactory", async function () {
  it("Should deploy token", async function () {
    const { lpFactory } = await setup();

    assert.ok(lpFactory.address, "LPFactory should have address");
  });


  it("Should create a pair successfully", async function () {
    const { lpFactory, token0, token1, publicClient } = await setup();
    const hash = await lpFactory.write.createLP([token0.address, token1.address]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    const pairAddr = await lpFactory.read.lpPairs([token0.address, token1.address]);
    assert.notEqual(pairAddr, "0x0000000000000000000000000000000000000000");
    const pairAddrReverse = await lpFactory.read.lpPairs([token1.address, token0.address]);
    assert.equal(pairAddr, pairAddrReverse);
  });
})