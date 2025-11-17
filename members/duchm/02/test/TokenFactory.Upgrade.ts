import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeFunctionData, parseUnits } from "viem";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import TokenFactoryV2Module from "../ignition/modules/TokenFactoryV2.js";

describe("TokenFactory Upgrade", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();
  let factoryProxy: any;
  let factory: any;

  it("Should deploy TokenFactory V1", async function () {
    const { tokenFactory } = await ignition.deploy(TokenFactoryModule);
    factoryProxy = tokenFactory.address;
    console.log("tokenFactory=", tokenFactory.address);
    factory = await viem.getContractAt("TokenFactory", tokenFactory.address);
    assert.ok(factory.address);

    // Verify it's V1 (if you added version function)
    // const version = await (factory as any).read.version();
    // assert.equal(version, 1n);
  });

  it("Should create tokens before upgrade", async function () {
    const tx = await factory.write.createToken([
      "PreUpgradeToken",
      "PUT",
      parseUnits("1000", 18),
    ]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const count = await factory.read.getTokenCount();
    assert.equal(count, 1n);
  });

  it("Should upgrade to V2", async function () {
    // Deploy V2 implementation
    const { tokenFactoryV2 } = await ignition.deploy(TokenFactoryV2Module);
    const v2Impl = await viem.getContractAt(
      "TokenFactoryV2",
      tokenFactoryV2.address
    );
    const [walletClient] = await viem.getWalletClients();
    // Upgrade proxy using writeContract with inline ABI
    const tx = await walletClient.writeContract({
      address: factoryProxy as `0x${string}`,
      abi: [
        {
          inputs: [
            {
              internalType: "address",
              name: "newImplementation",
              type: "address",
            },
            { internalType: "bytes", name: "data", type: "bytes" },
          ],
          name: "upgradeToAndCall",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "upgradeToAndCall",
      args: [v2Impl.address, "0x"],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Verify upgrade
    const factoryV2 = await viem.getContractAt("TokenFactoryV2", factoryProxy);
    const version = await factoryV2.read.getVersion();
    assert.equal(version, 2n);
  });

  it("Should preserve storage after upgrade", async function () {
    const factoryV2 = (await viem.getContractAt(
      "TokenFactoryV2",
      factoryProxy
    )) as any;

    const count = await factoryV2.read.getTokenCount();
    assert.equal(count, 1n, "Token count should persist after upgrade");
  });

  it("Should still work after upgrade", async function () {
    const factoryV2 = (await viem.getContractAt(
      "TokenFactoryV2",
      factoryProxy
    )) as any;

    // Create new token with V2
    const tx = await factoryV2.write.createToken([
      "PostUpgradeToken",
      "POT",
      parseUnits("2000", 18),
    ]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Verify count increased
    const count = await factoryV2.read.getTokenCount();
    assert.equal(count, 2n);
  });
});
