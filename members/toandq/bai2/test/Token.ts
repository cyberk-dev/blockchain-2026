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
          name: "CBK",
          symbol: "ABC",
          initialSupply: parseUnits("100", 18),
        },
      },
    });
  });
});
