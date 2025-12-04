import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress } from "viem";
import { network } from "hardhat";

describe("LPFactory", async function () {
  const { viem } = await network.connect();

  async function deployFixture() {
    const [owner, user] = await viem.getWalletClients();

    const mockToken0 = await viem.deployContract("MockToken", []);
    const mockToken1 = await viem.deployContract("MockToken", []);

    const factory = await viem.deployContract("LPFactory", []);

    return {
      owner,
      user,
      mockToken0,
      mockToken1,
      factory,
    };
  }

  it("should deploy successfully", async function () {
    const { networkHelpers } = await network.connect();
    const { factory } = await networkHelpers.loadFixture(deployFixture);

    const zeroAddress = "0x0000000000000000000000000000000000000000";
    const pair = await factory.read.lpPairs([zeroAddress, zeroAddress]);
    assert.equal(pair, zeroAddress);
  });

  it("should create a new LP pair", async function () {
    const { networkHelpers } = await network.connect();
    const { factory, mockToken0, mockToken1 } =
      await networkHelpers.loadFixture(deployFixture);

    const txPromise = factory.write.createLP([
      mockToken0.address,
      mockToken1.address,
    ]);

    await viem.assertions.emit(txPromise, factory, "LPCreated");
  });

  it("should revert if tokens are identical", async function () {
    const { networkHelpers } = await network.connect();
    const { factory, mockToken0 } = await networkHelpers.loadFixture(
      deployFixture
    );

    await assert.rejects(
      async () =>
        await factory.write.createLP([mockToken0.address, mockToken0.address]),
      /IdenticalAddresses/
    );
  });

  it("should revert if token is zero address", async function () {
    const { networkHelpers } = await network.connect();
    const { factory, mockToken0 } = await networkHelpers.loadFixture(
      deployFixture
    );

    const zeroAddress = "0x0000000000000000000000000000000000000000";
    await assert.rejects(
      async () =>
        await factory.write.createLP([zeroAddress, mockToken0.address]),
      (error: any) => {
        return (
          error.message?.includes("ZeroAddress") ||
          error.message?.includes("InvalidAddressError")
        );
      }
    );
  });

  it("should revert if LP already exists", async function () {
    const { networkHelpers } = await network.connect();
    const { factory, mockToken0, mockToken1 } =
      await networkHelpers.loadFixture(deployFixture);

    await factory.write.createLP([mockToken0.address, mockToken1.address]);

    await assert.rejects(
      async () =>
        await factory.write.createLP([mockToken0.address, mockToken1.address]),
      /LPExisted/
    );
  });
});
