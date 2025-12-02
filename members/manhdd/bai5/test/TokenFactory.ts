import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, parseEther } from "viem";
import { network } from "hardhat";

describe("TokenFactory", async function () {
  const { viem } = await network.connect();
  const CREATION_FEE = parseEther("0.01");

  async function deployFixture() {
    const [owner, creator, feeRecipient] = await viem.getWalletClients();

    const mockUSDT = await viem.deployContract("MockUSDT", []);

    const factory = await viem.deployContract("TokenFactory", [
      CREATION_FEE,
      feeRecipient.account.address,
    ]);

    const factoryAsCreator = await viem.getContractAt("TokenFactory", factory.address, {
      client: { wallet: creator },
    });

    return { owner, creator, feeRecipient, mockUSDT, factory, factoryAsCreator };
  }

  it("createToken requires creation fee", async function () {
    const { networkHelpers } = await network.connect();
    const { factoryAsCreator, mockUSDT } = await networkHelpers.loadFixture(deployFixture);

    await assert.rejects(
      async () => await factoryAsCreator.write.createToken(
        ["TestToken", "TT", 1n, 12n, mockUSDT.address, 3600n, 5n],
        { value: 0n }
      ),
      /InsufficientCreationFee/
    );
  });

  it("createToken succeeds with correct fee", async function () {
    const { networkHelpers } = await network.connect();
    const { factoryAsCreator, mockUSDT, factory } = await networkHelpers.loadFixture(deployFixture);

    const txPromise = factoryAsCreator.write.createToken(
      ["TestToken", "TT", 1n, 12n, mockUSDT.address, 3600n, 5n],
      { value: CREATION_FEE }
    );

    await viem.assertions.emit(txPromise, factory, "TokenCreated");
  });

  it("creation fee is sent to feeRecipient", async function () {
    const { networkHelpers } = await network.connect();
    const { factoryAsCreator, mockUSDT, feeRecipient } = await networkHelpers.loadFixture(deployFixture);
    const publicClient = await viem.getPublicClient();

    const balanceBefore = await publicClient.getBalance({ address: feeRecipient.account.address });

    await factoryAsCreator.write.createToken(
      ["TestToken", "TT", 1n, 12n, mockUSDT.address, 3600n, 5n],
      { value: CREATION_FEE }
    );

    const balanceAfter = await publicClient.getBalance({ address: feeRecipient.account.address });
    assert.equal(balanceAfter - balanceBefore, CREATION_FEE);
  });
});
