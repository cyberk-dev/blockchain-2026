import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";
import FactoryModule from "../ignition/modules/Factory.js";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { factory } = await ignition.deploy(FactoryModule)

  return { viem, ignition, publicClient, factory };
}

describe("Factory", async function () {
  it("Deploy factory", async function () {
    const { networkHelpers } = await network.connect();
    const { factory } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    console.log("factory", factory.address);
  });
  it("Create token", async function () {
    const { networkHelpers } = await network.connect();
    const { factory } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
    await factory.write.createToken(["Cyberk", "CBK", parseUnits("100000000", 18)]);
    // console.log("token", token.address);
  });
});