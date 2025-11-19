import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEventLog, parseUnits } from "viem";

import { network } from "hardhat";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

describe("TokenFactoryModule", async function () {
  const { ignition, viem } = await network.connect();
  const publicClient = viem.getPublicClient();

  it("should deploy Token via TokenFactory with correct parameters", async function () {
    const { factory } = await ignition.deploy(TokenFactoryModule, {});

    const tx = await factory.write.createToken([
      "FactoryToken",
      "FTK",
      parseUnits("500000", 18),
    ]);

    console.log("Transaction Hash:", tx);

    const receipt = (await publicClient).waitForTransactionReceipt({
      hash: tx,
    });

    const status = (await receipt).status;
    assert.equal(status, "success", "Transaction failed");
  });
});
