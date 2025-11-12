import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { network } from "hardhat";

describe("Token", async function () {
  const { viem } = await network.connect();
  const [deployer, wallet1, wallet2] = await viem.getWalletClients();
  let deployerContract: Awaited<ReturnType<typeof viem.deployContract>>,
    wallet1Contract: Awaited<ReturnType<typeof viem.deployContract>>,
    wallet2Contract: Awaited<ReturnType<typeof viem.deployContract>>;

  beforeEach(async function () {
    deployerContract = await viem.deployContract(
      "Token",
      ["LINH", "LL", 1000n],
      { client: { wallet: deployer } }
    );
    wallet1Contract = await viem.getContractAt(
      "Token",
      deployerContract.address,
      { client: { wallet: wallet1 } }
    );
    wallet2Contract = await viem.getContractAt(
      "Token",
      deployerContract.address,
      { client: { wallet: wallet2 } }
    );
  });

  it("Should deploy with correct name and symbol", async function () {
    const name = await deployerContract.read.name();
    const symbol = await deployerContract.read.symbol();

    assert.equal(name, "LINH");
    assert.equal(symbol, "LL");
  });

  it("Should have correct initial supply", async function () {
    const totalSupply = await deployerContract.read.totalSupply();
    assert.equal(totalSupply, 1000n);
  });

  it("Should mint initial supply to deployer", async function () {
    const deployerBalance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    assert.equal(deployerBalance, 1000n);
  });

  it("Should allow users to burn their tokens", async function () {
    const burnAmount = 200n;
    const initialBalance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);

    await deployerContract.write.burn([burnAmount]);

    const finalBalance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    const totalSupply = await deployerContract.read.totalSupply();

    assert.equal(finalBalance, initialBalance - burnAmount);
    assert.equal(totalSupply, 800n);
  });

  it("Should transfer to other wallets", async function () {
    const initialDeployerBalance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    const initialWallet1Balance = await wallet1Contract.read.balanceOf([
      wallet1.account.address,
    ]);
    const initialWallet2Balance = await wallet1Contract.read.balanceOf([
      wallet2.account.address,
    ]);

    await deployerContract.write.transfer([wallet1.account.address, 300n]);

    await wallet1Contract.write.transfer([wallet2.account.address, 150n]);

    const finalDeployerBalance = await deployerContract.read.balanceOf([
      deployer.account.address,
    ]);
    const finalWallet1Balance = await wallet1Contract.read.balanceOf([
      wallet1.account.address,
    ]);
    const finalWallet2Balance = await wallet1Contract.read.balanceOf([
      wallet2.account.address,
    ]);
    const totalSupply = await deployerContract.read.totalSupply();

    assert.equal(finalDeployerBalance, 700n);
    assert.equal(finalWallet1Balance, 150n);
    assert.equal(finalWallet2Balance, 150n);
    assert.equal(totalSupply, 1000n);

    deployerContract.write.pause();

    assert.rejects(
      wallet1Contract.write.transfer([wallet1.account.address, 100n])
    );
  });
});
