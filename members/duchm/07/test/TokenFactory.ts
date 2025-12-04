import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = connection;
  const publicClient = await viem.getPublicClient();
  const [owner, buyer1, buyer2] = await viem.getWalletClients();
  const { tokenFactory, paymentToken } = await ignition.deploy(TokenFactoryModule, {
    parameters: {
      TokenFactoryModule: {
        creationFee: parseEther("0.0003"),
        buyFee: parseEther("0.01"),
        feeReceipt: owner.account.address,
        slope: 10n ** 22n,
        basePrice: 12n
      },
    },
  });

  return {
    viem,
    ignition,
    publicClient,
    tokenFactory,
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

describe("TokenFactory", async function () {
  it("Should deploy token", async function () {
    const { tokenFactory } = await setup();

    assert.ok(tokenFactory.address, "Token should have an address");
  });

  it("Should fail if creation fee is insufficient", async function () {
    const { tokenFactory, owner } = await setup();
    const creationFee = await tokenFactory.read.creationFee();
    console.log('creationFee=', creationFee)
    await assert.rejects(
      tokenFactory.write.createToken(
        ["Test", "TST"],
        { account: owner.account, value: 0n }
      ),
      /InsufficientFee/
    );
  });

  it("Should collect creation fee", async function () {
    const { viem, tokenFactory, paymentToken, buyer1 } = await setup();
    const creationFee = await tokenFactory.read.creationFee();
    const feeReceipt = await tokenFactory.read.feeReceipt();
    await viem.assertions.balancesHaveChanged(
      tokenFactory.write.createToken(
        ["Test", "TST"],
        { account: buyer1.account, value: creationFee }
      ),
      [
        { address: buyer1.account.address, amount: -creationFee },
        { address: feeReceipt, amount: creationFee },
      ]
    )
  });

  it("Should token price P3 = P1 + P2", async function () {
    const { viem, tokenFactory, publicClient, owner } = await setup();
    const creationFee = await tokenFactory.read.creationFee();
    const hash = await tokenFactory.write.createToken(["Test", "TST"], { value: creationFee, account: owner.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [log] = await publicClient.getLogs({
      address: tokenFactory.address,
      event: { type: 'event', name: 'TokenCreated', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'address', name: 'owner', indexed: true }] },
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber
    });

    const newTokenAddress = log.args.token!;
    const token = await viem.getContractAt("Token", newTokenAddress!);

    const amount1 = parseUnits("1", 18);
    const amount10 = parseUnits("10", 18);
    const amount11 = parseUnits("11", 18);

    const a = await token.read.slope();
    const b = await token.read.basePrice();

    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+++%2B+12%2C%7Bx%2C1%2C1e18%7D%5D
    const p1 = await token.read.getCost([0n, amount1, a, b]);
    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+++%2B+12%2C%7Bx%2C1e18+%2B+1%2C11e18%7D%5D
    const p2 = await token.read.getCost([amount1, amount10, a, b]);
    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+++%2B+12%2C%7Bx%2C1%2C11e18%7D%5D
    const p3 = await token.read.getCost([0n, amount11, a, b]);

    console.log(p1, p2, p3)

    assert.equal(p3, p2 + p1);
  })

  it("Should buy tokens, split fees, and emit event", async function () {
    const { viem, tokenFactory, paymentToken, buyer1, publicClient, owner } = await setup();
    const creationFee = await tokenFactory.read.creationFee();
    const hash = await tokenFactory.write.createToken(["Test", "TST"], { value: creationFee, account: owner.account });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const [log] = await publicClient.getLogs({
      address: tokenFactory.address,
      event: { type: 'event', name: 'TokenCreated', inputs: [{ type: 'address', name: 'token', indexed: true }, { type: 'address', name: 'owner', indexed: true }] },
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber
    });

    const newTokenAddress = log.args.token!;
    const token = await viem.getContractAt("Token", newTokenAddress!);
    const amountToBuy = parseUnits("100", 18);
    const cost = await token.read.getCost([0n, amountToBuy, await token.read.slope(), await token.read.basePrice()]); // Use same params as factory defaults
    await paymentToken.write.mint([buyer1.account.address, cost]);
    await paymentToken.write.approve([newTokenAddress, cost], { account: buyer1.account });
    const feeReceipt = await tokenFactory.read.feeReceipt();
    const buyFee = await tokenFactory.read.buyFee();
    const expectedFee = cost * buyFee / parseEther("1");
    const expectedNet = cost - expectedFee;
    const txPromise = token.write.buy([amountToBuy], { account: buyer1.account })
    await viem.assertions.erc20BalancesHaveChanged(
      txPromise,
      paymentToken.address,
      [
        { address: feeReceipt, amount: expectedFee },
        { address: newTokenAddress, amount: expectedNet }
      ]
    );
    const buyHash = await txPromise;
    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });

    const [buyLog] = await publicClient.getLogs({
      address: token.address,
      event: {
        type: 'event',
        name: 'TokenBought',
        inputs: [
          { type: 'address', name: 'buyer' },
          { type: 'uint256', name: 'amount' },
          { type: 'uint256', name: 'cost' },
          { type: 'uint256', name: 'feeAmount' }
        ]
      },
      fromBlock: buyReceipt.blockNumber,
      toBlock: buyReceipt.blockNumber
    });
    assert.equal(buyLog.args.amount, amountToBuy);
    assert.equal(buyLog.args.feeAmount, expectedFee);
  })
})