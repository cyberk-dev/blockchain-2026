import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { parseUnits } from "viem";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Deploy ignition", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
          TokenModule: {
              name: "THAI",
              symbol: "TDQ",
              initialSupply: parseUnits("100000", 18),
          },
      },
    });
    console.log("Token deployed at:", token.address);
  });
});
