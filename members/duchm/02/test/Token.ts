import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";

describe("Counter", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Should Deloy ignition", async function () {
    await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Token",
          symbol: "TKN",
          totalSupply: parseUnits("100000", 18),
        },
      },
    });
  });
});
