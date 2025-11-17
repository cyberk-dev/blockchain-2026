import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Anderson.js";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Deploy ignition", async function () {
    await ignition.deploy(TokenModule, {
        parameters: {
            initialOwner: viem.getAccount(0).address,
        },
    })
  });
});