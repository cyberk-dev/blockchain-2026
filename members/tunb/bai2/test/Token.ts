import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("should deploy and initialize the Token contract", async function () {
    // const { token } = await ignition.deploy(TokenModule, {
    //   name: "MyToken",
    //   symbol: "MTK",
    //   totalSupply: 1000000n,
    // });
    // const name = await publicClient.readContract({
    //   address: token.address,
    //   abi: token.abi,
    //   functionName: "name",
    // });
    // const symbol = await publicClient.readContract({
    //   address: token.address,
    //   abi: token.abi,
    //   functionName: "symbol",
    // });
    // const totalSupply = await publicClient.readContract({
    //   address: token.address,
    //   abi: token.abi,
    //   functionName: "totalSupply",
    // });
  });
});
