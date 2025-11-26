import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";
import FactoryModule from "../ignition/modules/Factory.js";

async function deploy(connection: NetworkConnection) {
    const { viem, ignition } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const [, feeRecipientAccount] = await viem.getWalletClients();
    const feeRecipient = feeRecipientAccount.account.address;


    const { factory, mockToken } = await ignition.deploy(FactoryModule);
    const tokenFactory = await viem.getContractAt("TokenFactory", factory.address);

    const blockNumber = await publicClient.getBlockNumber();
    const block = await publicClient.getBlock({ blockNumber });
    const now = Number(block.timestamp);
    const endTimeFuture = now + 3600;

    return { viem, ignition, publicClient, tokenFactory, endTimeFuture, mockToken, feeRecipient };
}

describe("Factory", async function () {
    it("Create token", async function () {
        const { networkHelpers } = await network.connect();
        const { tokenFactory, viem, mockToken, endTimeFuture, feeRecipient, publicClient } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
        const fee = parseUnits("0.0001", 18);

        const before = await publicClient.getBalance({ address: feeRecipient });

        await tokenFactory.write.createToken(
            [
                "Cyberk",
                "CBK",
                mockToken.address,
                0n,
                BigInt(endTimeFuture),
                2n,
                4n,
                10n ** 24n,
            ],
            {
                value: parseUnits("0.0001", 18),
            }
        );
        const after = await publicClient.getBalance({ address: feeRecipient });


        const tokens = await tokenFactory.read.getAllTokens();
        assert.equal(tokens.length, 1, "Token created");
        const tokenAddr = tokens[0];
        const token = await viem.getContractAt("Token", tokenAddr);

        assert.equal(await token.read.name(), "Cyberk", "Token created");

        assert.equal(
            after - before,
            fee,
            "Fee recipient must receive 0.0001 ETH"
        );
    });
    it("Insufficient fee", async function () {
        const { networkHelpers } = await network.connect();
        const { tokenFactory, viem, mockToken, endTimeFuture, publicClient } = await networkHelpers.loadFixture(deploy.bind(networkHelpers));
        let isInsufficient = false;
        try {
            await tokenFactory.write.createToken(
                [
                    "Cyberk",
                    "CBK",
                    mockToken.address,
                    0n,
                    BigInt(endTimeFuture),
                    2n,
                    4n,
                    10n ** 24n,
                ],
                {
                    value: parseUnits("0.00001", 18),
                    account: publicClient.account,
                }
            );
        } catch {
            isInsufficient = true;
        };
        assert.equal(isInsufficient, true, "Not accept insufficient fee")
    }
    )
});