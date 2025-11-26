import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeEventLog, toEventSelector } from "viem";

import { network, artifacts } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { NetworkConnection } from "hardhat/types/network";

async function deploy(connection: NetworkConnection) {
    const { viem, ignition } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const [sender, feeRecipientAccount] = await viem.getWalletClients();
    const feeRecipient = feeRecipientAccount.account.address;

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
                a: 2n,
                b: 4n,
                scale: 10n ** 24n,
                endTime: BigInt(endTimeFuture),
                feeRecipient
            },
        },
    });

    const tokenAddress = (deployment.token as { address: `0x${string}` }).address;
    const token = await viem.getContractAt("Token", tokenAddress);
    const mockTokenAddress = (deployment.mockToken as { address: `0x${string}` }).address;
    const mockToken = await viem.getContractAt("MockToken", mockTokenAddress);

    return { viem, publicClient, token, usdt: mockToken, sender };
}

describe("Token Pricing & Buying", async function () {
    it("Price Check – First Token", async function () {
        const { networkHelpers } = await network.connect();
        const { token } = await networkHelpers.loadFixture(deploy);

        const oneToken = 10n ** 18n;
        const cost = await token.read.getCost([0n, oneToken]);
        const expected = 1000000000000n;
        //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5B%5C%2840%292x+%2B+4%5C%2841%29%2CPower%5B10%2C24%5D%5D%2C%7Bx%2C1%2CPower%5B10%2C18%5D%7D%5D

        assert.equal(cost, expected, "First token price mismatch");
    });

    it("Price Check – Next 10 Tokens", async function () {
        const { networkHelpers } = await network.connect();
        const { token } = await networkHelpers.loadFixture(deploy);

        const oneToken = 10n ** 18n;

        const tenTokens = 10n * (10n ** 18n);
        const cost = await token.read.getCost([oneToken, tenTokens]);
        const expected = 120000000000000n;
        //https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5B%5C%2840%292x+%2B+4%5C%2841%29%2CPower%5B10%2C24%5D%5D%2C%7Bx%2CPower%5B10%2C18%5D%2B1%2CPower%5B10%2C18%5D*11%7D%5D

        assert.equal(cost, expected, "10-token batch price mismatch");
    });

    it("Purchase Execution – buyToken succeeds", async function () {
        const { networkHelpers } = await network.connect();
        const { token, usdt, publicClient, sender } = await networkHelpers.loadFixture(deploy);

        const amount = 10n ** 18n;
        const fee = 1000000000n;
        const cost = 1000000000000n;
        const totalPayment = 1001000000000n
        await usdt.write.approve([token.address, totalPayment]);
        const txHash = await token.write.buyToken([amount], { value: totalPayment });

        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

        const eventLog = receipt.logs.find(
            (l) => l.address.toLowerCase() === token.address.toLowerCase()
        );

        assert.ok(eventLog, "TokenBought event log not found");
        const TokenArtifact = await artifacts.readArtifact("Token");
        const tokenBoughtSelector = toEventSelector(
            "TokenBought(address,uint256,uint256,uint256,uint256)"
        );
    
        const tokenBoughtLog = receipt.logs.find(
            (l) =>
                l.address.toLowerCase() === token.address.toLowerCase() &&
                l.topics[0] === tokenBoughtSelector
        );
    
        assert.ok(tokenBoughtLog, "TokenBought event log not found");
    
        const decoded = decodeEventLog({
            abi: TokenArtifact.abi,
            data: tokenBoughtLog.data,
            topics: tokenBoughtLog.topics,
        });
    
        assert.equal(decoded.eventName, "TokenBought");
        assert.equal(decoded.args.buyer.toLowerCase(), sender.account.address.toLowerCase());
        assert.equal(decoded.args.amount, amount);
        assert.equal(decoded.args.cost, cost);
        assert.equal(decoded.args.fee, fee);
        assert.equal(decoded.args.totalPayment, totalPayment);        //     abi: [
    });
});
