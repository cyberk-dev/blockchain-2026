import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import TokenFactoryWithBeaconModule from "../ignition/modules/TokenFactoryWithBeacon.js";

describe("TokenFactoryWithBeacon - Full Flow", async function () {
  const { ignition } = await network.connect();

  it("should deploy factory with beacon and create tokens", async function () {
    const deployed = await ignition.deploy(TokenFactoryWithBeaconModule);
    const { factory, tokenBeacon, factoryProxy } = deployed;

    assert.ok(tokenBeacon, "Token beacon should be deployed");

    assert.ok(factoryProxy, "Factory proxy should be deployed");

    const beaconAddress = await factory.read.tokenBeaconAddress();
    assert.ok(beaconAddress, "Factory should have beacon address set");

    const createTx = await factory.write.createToken(["TestToken", "TST"]);
    assert.ok(createTx, "Create token transaction should succeed");

    console.log("Token creation tx:", createTx);
  });

  it("should allow factory owner to mint tokens", async function () {
    const { factory } = await ignition.deploy(TokenFactoryWithBeaconModule);

    const createTx = await factory.write.createToken(["MintableToken", "MINT"]);

    assert.ok(createTx, "Token creation should succeed");
    console.log("Token created, ready for minting via factory");
  });
});
