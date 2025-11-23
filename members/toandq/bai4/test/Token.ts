import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatUnits, parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import UsdtModule from "../ignition/modules/Usdt.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition, } = await network.connect();
  const publicClient = await viem.getPublicClient();

  // Deploy USDT first
  const { usdt } = await ignition.deploy(UsdtModule);

  // Deploy Token with USDT address
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        usdtAddress: usdt.address,
      },
    }
  })

  return { viem, ignition, publicClient, token, usdt };
}

describe("Token", async function () {

  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { token, usdt } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    console.log("usdt", usdt.address);
    console.log("token", token.address);
  });

});