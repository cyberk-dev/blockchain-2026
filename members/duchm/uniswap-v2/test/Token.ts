import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = connection;
  const publicClient = await viem.getPublicClient();
  const [owner, buyer1, buyer2] = await viem.getWalletClients();
  const { token, paymentToken } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "Duchm",
        symbol: "DCH",
        slope: 10n ** 22n,
        basePrice: 12n,
      },
    },
  });

  return {
    viem,
    ignition,
    publicClient,
    token,
    paymentToken,
    owner,
    buyer1,
    buyer2,
  };
}

async function setup() {
  const { networkHelpers } = await network.connect();
  const ctx = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
  return ctx;
}

describe("Token", async function () {
  it("Should deploy token", async function () {
    const { token } = await setup();

    assert.ok(token.address, "Token should have an address");
    const name = await token.read.name();
    assert.equal(name, "Duchm", "Token should have correct name");
  });

  it("Should prove P3=P2+P1", async function () {
    const { token } = await setup();

    const amount1 = parseUnits("1", 18);
    const amount10 = parseUnits("10", 18);
    const amount11 = parseUnits("11", 18);

    const a = await token.read.slope();
    const b = await token.read.basePrice();

    const p1 = await token.read.getCost([0n, amount1, a, b]);
    const p2 = await token.read.getCost([amount1, amount10, a, b]);
    const p3 = await token.read.getCost([0n, amount11, a, b]);

    console.log(p1, p2, p3);

    assert.equal(p3, p2 + p1);
  });

  it("Should show that price increases with supply", async function () {
    const { token } = await setup();
    const amount1 = parseUnits("1", 18);

    const a = await token.read.slope();
    const b = await token.read.basePrice();

    const costOfFirstToken = await token.read.getCost([0n, amount1, a, b]);

    const costOf100thToken = await token.read.getCost([
      parseUnits("99", 18),
      amount1,
      a,
      b,
    ]);

    console.log(
      "Cost of 1st token:",
      costOfFirstToken,
      "Cost of 100th token:",
      costOf100thToken
    );

    assert.ok(
      costOf100thToken > costOfFirstToken,
      "The cost of a 100th token should higher than first one"
    );
  });

  it("Should execute a purchase and transfer ERC20 tokens", async function () {
    const { token, paymentToken, buyer1, viem } = await setup();

    const amount = parseUnits("10000", 18);

    const mintAmount = parseEther("10000");
    await paymentToken.write.mint([buyer1.account.address, mintAmount]);

    const cost = await token.read.getCost([
      await token.read.tokenSold(),
      amount,
      await token.read.slope(),
      await token.read.basePrice(),
    ]);

    await paymentToken.write.approve([token.address, cost], {
      account: buyer1.account,
    });

    await viem.assertions.erc20BalancesHaveChanged(
      token.write.buy([amount], {
        account: buyer1.account,
      }),
      paymentToken.address,
      [
        { address: buyer1.account.address, amount: -cost },
        { address: token.address, amount: cost },
      ]
    );
  });
});
