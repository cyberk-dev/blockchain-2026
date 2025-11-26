import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
    const { viem, ignition } = await network.connect();
    const publicClient = await viem.getPublicClient();

    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    const now = Number(block.timestamp);
    const endTimeFuture = now + 3600;

    const deployment = await ignition.deploy(TokenModule, {
        parameters: {
            TokenModule: {
                name: "Cyberk",
                symbol: "CBK",
                initialSupply: 0n,
                a: 1n,
                b: 12n,
                scale: 10n ** 22n,
                endTime: BigInt(endTimeFuture)
            },
        },
    });

    const tokenAddress = (deployment.token as { address: `0x${string}` }).address;
    const token = await viem.getContractAt("Token", tokenAddress);
    const mockTokenAddress = (deployment.mockToken as { address: `0x${string}` }).address;
    const mockToken = await viem.getContractAt("MockToken", mockTokenAddress);

    return { viem, publicClient, token, usdt: mockToken };
}

function manualCost(a: bigint, b: bigint, SCALE: bigint, s: bigint, m: bigint) {
    const numerator = a * (m * s) + a * ((m * (m + 1n)) / 2n) + b * m;
    return numerator / SCALE;
}

describe("Token Pricing & Buying", async function () {
    it("Price Check – First Token", async function () {
        const { networkHelpers } = await network.connect();
        const { token } = await networkHelpers.loadFixture(deploy);

        const oneToken = 10n ** 18n;
        const cost = await token.read.getCost([0n, oneToken]);
        const expected = manualCost(1n, 12n, 10n ** 22n, 0n, oneToken);

        assert.equal(cost, expected, "First token price mismatch");
    });

    it("Price Check – Next 10 Tokens", async function () {
        const { networkHelpers } = await network.connect();
        const { token } = await networkHelpers.loadFixture(deploy);

        const oneToken = 10n ** 18n;

        const tenTokens = 10n * (10n ** 18n);
        const cost = await token.read.getCost([oneToken, tenTokens]);
        const expected = manualCost(1n, 12n, 10n ** 22n, oneToken, tenTokens);

        assert.equal(cost, expected, "10-token batch price mismatch");
    });

    it("Formula Check – First Token + Next 10 Tokens = 11 First Tokens", async function () {
        const { networkHelpers } = await network.connect();
        const { token } = await networkHelpers.loadFixture(deploy);

        const oneToken = 10n ** 18n;
        const firstTokenCost = await token.read.getCost([0n, oneToken]);

        const tenTokens = 10n * (10n ** 18n);
        const nextTenTokensCost = await token.read.getCost([oneToken, tenTokens]);

        const cost = firstTokenCost + nextTenTokensCost;

        const elevenTokens = 11n * (10n ** 18n);
        const expected = manualCost(1n, 12n, 10n ** 22n, 0n, elevenTokens);

        assert.equal(cost, expected, "Formula is wrong");
    });

    it("Purchase Execution – buyToken succeeds", async function () {
        const { networkHelpers } = await network.connect();
        const { token, usdt } = await networkHelpers.loadFixture(deploy);

        const amount = 5n * (10n ** 18n);
        const cost = manualCost(1n, 12n, 10n ** 22n, 0n, amount);
        await usdt.write.approve([token.address, cost]);
        await token.write.buyToken([amount], { value: cost });
    });

    // it("Events & Balance Check", async function () {
    //   const { networkHelpers, viem } = await network.connect();
    //   const { token, publicClient } = await networkHelpers.loadFixture(deploy);

    //   const buyer = (await viem.getWalletClients())[1]; // second account

    //   const amount = 3n;
    //   const cost = manualCost(1n, 12n, 10n ** 22n, 5n, amount);

    //   const contractBalBefore = await publicClient.getBalance({
    //     address: token.address,
    //   });

    //   const userTokenBalBefore = await token.read.balanceOf([buyer.account.address]);

    //   // buy token
    //   const hash = await token.write.buyToken([amount], {
    //     account: buyer.account,
    //     value: cost,
    //   });

    //   const receipt = await publicClient.waitForTransactionReceipt({ hash });

    //   // ---- EVENT ----
    //   const log = receipt.logs.find((l) => l.eventName === "TokenBought");
    //   assert.ok(log, "TokenBought event missing");

    //   assert.equal(log.args.buyer, buyer.account.address);
    //   assert.equal(log.args.amount, amount);
    //   assert.equal(log.args.cost, cost);

    //   // ---- TOKEN BALANCE ----
    //   const userTokenBalAfter = await token.read.balanceOf([buyer.account.address]);
    //   assert.equal(userTokenBalAfter - userTokenBalBefore, amount);

    //   // ---- CONTRACT ETH BALANCE ----
    //   const contractBalAfter = await publicClient.getBalance({
    //     address: token.address,
    //   });

    //   assert.equal(
    //     contractBalAfter - contractBalBefore,
    //     cost,
    //     "ETH balance mismatch after purchase"
    //   );
    // });
});
