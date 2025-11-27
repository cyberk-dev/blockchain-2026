import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { network } from "hardhat";
import { isAddressEqual } from "viem";

describe("TokenFactory", async function () {
  const { viem, networkHelpers } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, alice] = await viem.getWalletClients();

  const creationFee = 1_000_000_000_000_000n; // 0.001 ETH
  const slope = 1n;
  const basePrice = 10n ** 18n;

  async function futureEndTime() {
    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    return block.timestamp + 3600n;
  }

  async function deployFactory() {
    const factory = await viem.deployContract("TokenFactory", [creationFee]);
    return { factory };
  }

  let factory: Awaited<ReturnType<typeof deployFactory>>["factory"];

  beforeEach(async () => {
    ({ factory } = await networkHelpers.loadFixture(deployFactory));
  });

  it("reverts when the exact creation fee is not provided", async function () {
    const endTime = await futureEndTime();
    await assert.rejects(
      async () =>
        factory.write.createToken(
          ["Bonding Curve Token", "BCT", endTime, slope, basePrice],
          {
            account: alice.account.address,
            value: creationFee - 1n,
          },
        ),
      /InvalidCreationFee/,
    );
  });

  it("creates a token, tracks it per owner, and forwards the fee", async function () {
    const endTime = await futureEndTime();
    const feeRecipient = deployer.account.address;
    const balanceBefore = await publicClient.getBalance({
      address: feeRecipient,
    });

    const txHash = await factory.write.createToken(
      ["Bonding Curve Token", "BCT", endTime, slope, basePrice],
      {
        account: alice.account.address,
        value: creationFee,
      },
    );

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const tokens = await factory.read.getTokens([alice.account.address]);
    assert.equal(tokens.length, 1);

    const token = await viem.getContractAt("Token", tokens[0]);
    const owner = await token.read.owner();
    assert.ok(isAddressEqual(owner, alice.account.address));

    const balanceAfter = await publicClient.getBalance({
      address: feeRecipient,
    });
    assert.equal(balanceAfter - balanceBefore, creationFee);
  });
});
