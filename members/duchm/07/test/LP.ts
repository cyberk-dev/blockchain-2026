import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEther, parseUnits } from "viem";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";
import LPModule from "../ignition/modules/LP.js";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = connection;
  const publicClient = await viem.getPublicClient();
  const [owner, buyer1, buyer2] = await viem.getWalletClients();
  const { lpFactory, token0, token1 } = await ignition.deploy(LPModule, {
    parameters: {}
  });

  return {
    viem,
    ignition,
    publicClient,
    lpFactory,
    owner,
    buyer1,
    buyer2,
    token1, token0,
  };
}

async function setup() {
  const { networkHelpers } = await network.connect();
  const ctx = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
  return ctx;
}

const mintAndApprove = async (token: any, account: any, spender: string, amount: bigint) => {
  await token.write.mint([account.address, amount]);
  await token.write.approve([spender, amount], { account });
};

const getPair = async (viem: any, factory: any, t0: string, t1: string, acc: any) => {
  const pairAddr = await factory.read.lpPairs([t0, t1]);
  return await viem.getContractAt("LPToken", pairAddr, { client: { wallet: acc } });
};

describe("TokenFactory", async function () {
  it("Should deploy token", async function () {
    const { lpFactory } = await setup();

    assert.ok(lpFactory.address, "LPFactory should have address");
  });


  it("Should create a pair successfully", async function () {
    const { lpFactory, token0, token1, publicClient } = await setup();
    const hash = await lpFactory.write.createLP([token0.address, token1.address]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    const pairAddr = await lpFactory.read.lpPairs([token0.address, token1.address]);
    assert.notEqual(pairAddr, "0x0000000000000000000000000000000000000000");
    const pairAddrReverse = await lpFactory.read.lpPairs([token1.address, token0.address]);
    assert.equal(pairAddr, pairAddrReverse);
  });

  it("Should add liquidity", async function () {
    const { lpFactory, token0, token1, owner, viem } = await setup();
    await lpFactory.write.createLP([token0.address, token1.address]);
    const pair = await getPair(viem, lpFactory, token0.address, token1.address, owner);
    await mintAndApprove(token0, owner.account, pair.address, parseEther("10000"));
    await mintAndApprove(token1, owner.account, pair.address, parseEther("10000"));
    await pair.write.addLiquidity([parseEther("100"), parseEther("400")]);
    const balance1 = await pair.read.balanceOf([owner.account.address]);
    assert.equal(balance1, parseEther("200"));

    await pair.write.addLiquidity([parseEther("500"), parseEther("500")]);
    const balance2 = await pair.read.balanceOf([owner.account.address]);
    assert.equal(balance2, parseEther("450"));
  });
})