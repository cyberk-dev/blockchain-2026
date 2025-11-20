import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("TokenModule", async function () {
  const { ignition } = await network.connect();

  it("should deploy Token contract with correct parameters", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "MyToken",
          symbol: "MTK",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    console.log("Token address:", token.address);
  });
});
