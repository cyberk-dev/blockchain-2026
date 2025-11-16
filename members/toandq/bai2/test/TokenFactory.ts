import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { Address, decodeEventLog, isAddress, parseUnits } from "viem";
import TokenFactory from "../ignition/modules/TokenFactory.js";
import UpgradeFactoryModule from "../ignition/modules/UpgradeFactory.js";

describe("TokenFactory", async function () {
  const { viem, ignition, networkHelpers, } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const { loadFixture, time, } = networkHelpers;

  async function deployFactoryFixtrue() {
    const [owner, addr1, addr2] = await viem.getWalletClients();

    const { factory } = await ignition.deploy(TokenFactory);

    return { factory, owner, addr1, addr2 };
  }

  it("Deploy factory", async function () {
    const { factory } = await loadFixture(deployFactoryFixtrue);
    console.log(factory.address)
  });

  it("Should deploy token successfully", async function () {
    const { factory } = await loadFixture(deployFactoryFixtrue);

    await viem.assertions.emit(
      factory.write.deployNewToken([
        "Test Token",
        "TT",
        1000000000000000000n,
      ]),
      factory,
      "TokenDeployed",
    );
  });

  it.skip('Should upgrade successfully', async () => {

  });
});
