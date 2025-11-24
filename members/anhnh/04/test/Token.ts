import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  const { ignition } = await network.connect();
  it("Deploy ignition", async function () {
    const { token }: { token: { address: string } } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Anhnh Token",
          symbol: "ANHT",
          initialSupply: parseUnits("100000000", 18),
        },
      },
    });
    console.log("token", token.address);
  });
});
