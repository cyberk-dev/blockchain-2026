import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseUnits, getContract, keccak256, toHex, erc20Abi } from "viem";

import { network } from "hardhat";
import { extractEvent } from "./utils.js";
import { baseFixture, BaseFixtureType } from "./fixture.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(this: any) {
  const connection = this as NetworkConnection;
  return await baseFixture(connection);
}

describe("TokenFactory", async function () {
  let fixture: BaseFixtureType;

  beforeEach(async function () {
    const connection = await network.connect();
    fixture = await connection.networkHelpers.loadFixture(
      deploy.bind(connection)
    );
  });

  it("Should deploy TokenFactory successfully", async function () {
    const { tokenFactory, users } = fixture;
    assert.ok(tokenFactory.address, "TokenFactory should have an address");

    const TOKEN_CREATOR_ROLE = keccak256(toHex("TOKEN_CREATOR_ROLE"));
    const hasRole = await tokenFactory.read.hasRole([
      TOKEN_CREATOR_ROLE,
      users.deployer.account.address,
    ]);
    assert.equal(hasRole, true, "Admin should have TOKEN_CREATOR_ROLE");
  });

  it("Should allow deployer to create token", async function () {
    const { tokenFactory, users, viem, connection, publicClient } = fixture;
    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const tokenSupply = parseUnits("1000000", 18);

    const createTokenTx = tokenFactory.write.createToken([
      tokenName,
      tokenSymbol,
      tokenSupply,
    ]);
    await viem.assertions.emit(createTokenTx, tokenFactory, "TokenCreated");

    // Find the TokenCreated event from TokenFactory (not the Transfer event from the new token)
    const tokenCreatedEvent = await extractEvent(
      connection,
      tokenFactory,
      await createTokenTx,
      "TokenCreated"
    );
    assert.ok(tokenCreatedEvent, "TokenCreated event should be emitted");

    const { token } = tokenCreatedEvent?.args as any;
    const tokenContract = getContract({
      address: token,
      abi: erc20Abi,
      client: publicClient,
    });

    const name = await tokenContract.read.name();
    const symbol = await tokenContract.read.symbol();
    const totalSupply = await tokenContract.read.totalSupply();

    assert.equal(name, tokenName, "Token name should match");
    assert.equal(symbol, tokenSymbol, "Token symbol should match");
    assert.equal(totalSupply, tokenSupply, "Token supply should match");
  });

  it("Should reject createToken from non-admin", async function () {
    const { tokenFactory, users } = fixture;
    const tokenName = "Test Token";
    const tokenSymbol = "TEST";
    const tokenSupply = parseUnits("1000000", 18);

    const tokenFactoryAsUser = getContract({
      address: tokenFactory.address,
      abi: tokenFactory.abi,
      client: users.user1,
    });

    try {
      await tokenFactoryAsUser.write.createToken([
        tokenName,
        tokenSymbol,
        tokenSupply,
      ]);
      assert.fail("Should have thrown an error for non-admin");
    } catch (error: any) {
      // Verify it's an access control error
      assert.ok(
        error.message.includes("AccessControlUnauthorizedAccount") ||
          error.message.includes("revert") ||
          error.message.includes("execution reverted"),
        "Should revert with access control error"
      );
      console.log("Non-admin correctly rejected from creating token");
    }
  });
});
