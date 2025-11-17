import { expect } from "chai";
import { describe, it } from "node:test";
import { parseUnits } from "viem";
import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Should deploy token with correct parameters", async function () {
    const tokenParams = {
      name: "MyToken",
      symbol: "MTK",
      initialSupply: parseUnits("1000000", 18)
    };

    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: tokenParams
      }
    });

    const [owner] = await viem.getWalletClients();    
  });
});
