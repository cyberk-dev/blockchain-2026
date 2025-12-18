import { network } from "hardhat";
import assert from "node:assert";
import { describe, it } from "node:test";
import { getAddress, parseUnits } from "viem";

const TOKEN_NAME = "Token";
const TOKEN_SYMBOL = "ERC20";
const initialSupply = parseUnits("1000000", 18);

async function deploy() {
	const { viem, ignition } = await network.connect();
	const publicClient = await viem.getPublicClient();
	const [owner] = await viem.getWalletClients();

	const token = await viem.deployContract("Token", [
		TOKEN_NAME,
		TOKEN_SYMBOL,
		initialSupply,
	]);

	return { owner, token, viem };
}

describe("Token", async function () {
	it("Should deploy Token contract", async function () {
		const { networkHelpers } = await network.connect();
		const { token } = await networkHelpers.loadFixture(deploy);

		const name = await token.read.name();
		const symbol = await token.read.symbol();
		const totalSupply = await token.read.totalSupply();

		assert.equal(name, TOKEN_NAME);
		assert.equal(symbol, TOKEN_SYMBOL);
		assert.equal(totalSupply, initialSupply);
	});
});
