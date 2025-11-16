import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";
import { network } from "hardhat";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

const erc20MinimalAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
];

describe("TokenFactory", async function () {
  const { ignition, viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getAccounts();

  it("deploy factory and create token", async function () {
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {});

    const supply = parseUnits("1000", 18);
    const tx = await factory.write.createToken(["Factory Token", "FCT", supply], { account: deployer });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");

    const tokensForCreator = await factory.read.getCreatorTokens([deployer]);
    assert.ok(tokensForCreator.length >= 1);
    const tokenAddress = tokensForCreator[tokensForCreator.length - 1] as `0x${string}`;

    const bal: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20MinimalAbi,
      functionName: "balanceOf",
      args: [deployer],
    });
    assert.equal(bal, supply);
  });
});


