import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import LPTokenModule from "../ignition/modules/LPToken.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  const { lpToken } = await ignition.deploy(LPTokenModule);

  return { viem, ignition, publicClient, lpToken };
}

async function deployWithPool(connection: NetworkConnection) {
  const { viem, ignition, publicClient, lpToken } = await deploy(connection);
  const [deployer, user] = await viem.getWalletClients();

  const token0 = await viem.deployContract("MockERC20", ["Token0", "T0", parseUnits("1000000", 18)]);
  const token1 = await viem.deployContract("MockERC20", ["Token1", "T1", parseUnits("1000000", 18)]);


  await token0.write.approve([lpToken.address, parseUnits("100", 18)], { account: deployer.account });
  await token1.write.approve([lpToken.address, parseUnits("1000", 18)], { account: deployer.account });
  
  await token0.write.transfer([lpToken.address, parseUnits("100", 18)], { account: deployer.account });
  await token1.write.transfer([lpToken.address, parseUnits("1000", 18)], { account: deployer.account });

  await lpToken.write.initialize(
    [token0.address, token1.address, parseUnits("100", 18), parseUnits("1000", 18)],
    { account: deployer.account }
  );

  await token0.write.mint([user.account.address, parseUnits("100", 18)], { account: deployer.account });
  await token1.write.mint([user.account.address, parseUnits("100", 18)], { account: deployer.account });

  return { viem, ignition, publicClient, lpToken, token0, token1, user, deployer };
}

describe("LPToken", async function () {
  it("Deploy ignition", async function () {
    const { networkHelpers } = await network.connect();
    const { lpToken } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));

    console.log("lpToken", lpToken.address);
  });

  it("Swap amount out - nhận 100 T1, đổi T0", async function () {
    const { networkHelpers } = await network.connect();
    const { token0, token1, lpToken, user, publicClient } = await networkHelpers.loadFixture(
      deployWithPool.bind(networkHelpers)
    );

    const amountOut = parseUnits("100", 18);
    const amountInMax = parseUnits("15", 18);

    await token0.write.approve([lpToken.address, amountInMax], { account: user.account });

    const balanceT1Before = (await token1.read.balanceOf([user.account.address])) as bigint;

    const hash = await lpToken.write.swap_exact_out(
      [amountOut, amountInMax, token1.address, user.account.address],
      { account: user.account }
    );

    await publicClient.waitForTransactionReceipt({ hash });

    const balanceT1After = (await token1.read.balanceOf([user.account.address])) as bigint;

    assert.equal(balanceT1After - balanceT1Before, amountOut, "User phải nhận đúng 100 T1");
  });
});
