import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Linear Bonding Curve Token", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClient = await viem.getWalletClients().then((w) => w[0]);

  it("should buy tokens correctly", async function () {
    const slope = 10n ** 24n; //a
    const initialPrice = 1n; // b
    const amount = 1n; // n

    const usdtDeployment = await viem.deployContract("USDT", [
      "Tether USD",
      "USDT",
    ]);

    console.log("USDT deployed at:", usdtDeployment.address);

    const usdtContract = await viem.getContractAt(
      "USDT",
      usdtDeployment.address
    );

    // Deploy contract
    const deployment = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      usdtDeployment.address,
    ]);

    const tokenAddress = deployment.address;

    // https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e24%5D%2C%7Bx%2C1%2C1e18%7D%5D+%2B+1
    // Calculate expected cost: cost(s,m) = m*(1 + 2ab + m + 2s) / (2a)
    // s = 0 (no tokens sold yet)
    // cost = m*(1 + 2ab + m) / (2a) = amount*(1 + 2*slope*initialPrice + amount) / (2*slope)
    await usdtContract.write.approve([tokenAddress, amount * 10n ** 18n]);
    console.log(
      "Approved USDT for Token contract, amount:",
      (amount * 10n ** 18n).toString()
    );

    // Buy tokens
    const buyTx = await walletClient.writeContract({
      address: tokenAddress,
      abi: deployment.abi,
      functionName: "buyToken",
      args: [amount],
      value: 0n,
    });

    await publicClient.waitForTransactionReceipt({ hash: buyTx });

    // Check token balance
    const balance = (await publicClient.readContract({
      address: tokenAddress,
      abi: deployment.abi,
      functionName: "balanceOf",
      args: [walletClient.account.address],
    })) as bigint;

    const expectedTokenBalance = amount * 10n ** 18n + 1000n * 10n ** 18n; // amount + initial mint
    console.log("Token balance:", balance.toString());
    assert.equal(balance, expectedTokenBalance, "Token balance should match");
  });
});
