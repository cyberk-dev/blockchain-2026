import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { network } from "hardhat";

describe("Token", async function () {
  const { viem } = await network.connect();
  const [deployer, wallet1] = await viem.getWalletClients();
  let deployerContract: Awaited<ReturnType<typeof viem.deployContract>>,
    wallet1Contract: Awaited<ReturnType<typeof viem.deployContract>>;

  beforeEach(async function () {
    deployerContract = await viem.deployContract(
      "Token",
      ["TuanToken", "tuantt"],
      {
        client: { wallet: deployer },
      }
    );
    wallet1Contract = await viem.getContractAt(
      "Token",
      deployerContract.address,
      { client: { wallet: wallet1 } }
    );
  });

  it("Should deploy with correct name and symbol", async function () {
    const name = await deployerContract.read.name();
    const symbol = await deployerContract.read.symbol();

    assert.equal(name, "TuanToken");
    assert.equal(symbol, "tuantt");
  });

  it("Owner should be able to mint tokens", async function () {
    const amount = 1000n;

    await deployerContract.write.mint([deployer.account.address, amount]);

    const balance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    assert.equal(balance, amount);
  });

  it("Non-owner should NOT be able to mint", async function () {
    // wallet1 is not the owner, so mint should revert / be rejected
    await assert.rejects(async () => {
      await wallet1Contract.write.mint([wallet1.account.address, 1n]);
    });
  });

  it("decimals should be 18", async function () {
    const decimals = await deployerContract.read.decimals();
    assert.equal(Number(decimals), 18);
  });

  it("totalSupply should update when owner mints", async function () {
    const before = await deployerContract.read.totalSupply();
    assert.equal(before, 0n);

    const amount = 5000n;
    await deployerContract.write.mint([deployer.account.address, amount]);

    const after = await deployerContract.read.totalSupply();
    assert.equal(after, amount);
  });

  it("transfer should move tokens between accounts", async function () {
    const mintAmount = 1000n;
    const sendAmount = 250n;

    // mint to deployer
    await deployerContract.write.mint([deployer.account.address, mintAmount]);

    // perform transfer from deployer -> wallet1
    await deployerContract.write.transfer([
      wallet1.account.address,
      sendAmount,
    ]);

    const deployerBal = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    const wallet1Bal = await deployerContract.read.balanceOf([
      wallet1.account.address,
    ]);

    assert.equal(deployerBal, mintAmount - sendAmount);
    assert.equal(wallet1Bal, sendAmount);
  });

  it("approve and transferFrom should work and reduce allowance", async function () {
    const mintAmount = 2000n;
    const spendAmount = 600n;

    // mint to deployer
    await deployerContract.write.mint([deployer.account.address, mintAmount]);

    // deployer approves wallet1 to spend
    await deployerContract.write.approve([
      wallet1.account.address,
      spendAmount,
    ]);

    // wallet1 calls transferFrom to move funds from deployer -> wallet1
    await wallet1Contract.write.transferFrom([
      deployer.account.address,
      wallet1.account.address,
      spendAmount,
    ]);

    const wallet1Bal = await deployerContract.read.balanceOf([
      wallet1.account.address,
    ]);
    assert.equal(wallet1Bal, spendAmount);

    const remainingAllowance = await deployerContract.read.allowance([
      deployer.account.address,
      wallet1.account.address,
    ]);
    assert.equal(remainingAllowance, 0n);
  });
});
