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

	const token0 = await viem.deployContract("Token", [
		TOKEN_NAME,
		TOKEN_SYMBOL,
		initialSupply,
	]);

	const token1 = await viem.deployContract("Token", [
		TOKEN_NAME,
		TOKEN_SYMBOL,
		initialSupply,
	]);

	const lpToken = await viem.deployContract("LPToken", [
		token0.address,
		token1.address,
	]);

	return { owner, token0, token1, lpToken, viem };
}

describe("LPToken", async function () {
	it("Should deploy LPToken contract", async function () {
		const { networkHelpers } = await network.connect();
		const { token0, token1, lpToken } = await networkHelpers.loadFixture(
			deploy
		);

		const token0Address = await lpToken.read.token0();
		const token1Address = await lpToken.read.token1();

		assert.equal(getAddress(token0Address), getAddress(token0.address));
		assert.equal(getAddress(token1Address), getAddress(token1.address));
	});

	describe("Add liquidity", () => {
		it("should revert if amount0 or amount1 is 0", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("1000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("1000", 18)]);

			await viem.assertions.revertWithCustomError(
				lpToken.write.mintLiquidity([0n, parseUnits("1000", 18)]),
				lpToken,
				"InvalidAmount"
			);
		});

		it("should add liquidity successfully first time", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("1000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("1000", 18)]);

			const tx = lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.erc20BalancesHaveChanged(tx, token0.address, [
				{ address: owner.account.address, amount: -parseUnits("100", 18) },
				{ address: lpToken.address, amount: parseUnits("100", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, token1.address, [
				{ address: owner.account.address, amount: -parseUnits("1000", 18) },
				{ address: lpToken.address, amount: parseUnits("1000", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, lpToken.address, [
				{
					address: owner.account.address,
					amount: parseUnits("100", 18),
				},
			]);
		});

		it("should add liquidity successfully second time", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("10000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("10000", 18)]);

			const tx = lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.erc20BalancesHaveChanged(tx, token0.address, [
				{ address: owner.account.address, amount: -parseUnits("100", 18) },
				{ address: lpToken.address, amount: parseUnits("100", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, token1.address, [
				{ address: owner.account.address, amount: -parseUnits("1000", 18) },
				{ address: lpToken.address, amount: parseUnits("1000", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, lpToken.address, [
				{ address: owner.account.address, amount: parseUnits("100", 18) },
			]);

			const tx2 = lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.erc20BalancesHaveChanged(tx2, token0.address, [
				{ address: owner.account.address, amount: -parseUnits("100", 18) },
				{ address: lpToken.address, amount: parseUnits("100", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx2, token1.address, [
				{ address: owner.account.address, amount: -parseUnits("1000", 18) },
				{ address: lpToken.address, amount: parseUnits("1000", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx2, lpToken.address, [
				{ address: owner.account.address, amount: parseUnits("100", 18) },
			]);
		});

		it("should add liquidity successfully with different ratio", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("10000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("10000", 18)]);

			const tx = lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.erc20BalancesHaveChanged(tx, token0.address, [
				{ address: owner.account.address, amount: -parseUnits("100", 18) },
				{ address: lpToken.address, amount: parseUnits("100", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, token1.address, [
				{ address: owner.account.address, amount: -parseUnits("1000", 18) },
				{ address: lpToken.address, amount: parseUnits("1000", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, lpToken.address, [
				{ address: owner.account.address, amount: parseUnits("100", 18) },
			]);

			const tx2 = lpToken.write.mintLiquidity([
				parseUnits("200", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.erc20BalancesHaveChanged(tx2, token0.address, [
				{ address: owner.account.address, amount: -parseUnits("100", 18) },
				{ address: lpToken.address, amount: parseUnits("100", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx2, token1.address, [
				{ address: owner.account.address, amount: -parseUnits("1000", 18) },
				{ address: lpToken.address, amount: parseUnits("1000", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx2, lpToken.address, [
				{ address: owner.account.address, amount: parseUnits("100", 18) },
			]);
		});
	});

	describe("Burn liquidity", () => {
		it("should revert if amount is greater than total supply", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await viem.assertions.revertWithCustomError(
				lpToken.write.burnLiquidity([parseUnits("1000", 18)]),
				lpToken,
				"InsufficientLiquidityBurned"
			);
		});
		it("should revert if amount is 0", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("1000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("1000", 18)]);

			await lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			await viem.assertions.revertWithCustomError(
				lpToken.write.burnLiquidity([0n]),
				lpToken,
				"InsufficientLiquidityBurned"
			);
		});
		it("should remove liquidity successfully", async () => {
			const { networkHelpers } = await network.connect();
			const { token0, token1, lpToken, owner, viem } =
				await networkHelpers.loadFixture(deploy);

			await token0.write.approve([lpToken.address, parseUnits("1000", 18)]);
			await token1.write.approve([lpToken.address, parseUnits("1000", 18)]);

			await lpToken.write.mintLiquidity([
				parseUnits("100", 18),
				parseUnits("1000", 18),
			]);

			const tx = lpToken.write.burnLiquidity([parseUnits("50", 18)]);

			await viem.assertions.erc20BalancesHaveChanged(tx, token0.address, [
				{ address: owner.account.address, amount: parseUnits("50", 18) },
				{ address: lpToken.address, amount: -parseUnits("50", 18) },
			]);
			await viem.assertions.erc20BalancesHaveChanged(tx, token1.address, [
				{ address: owner.account.address, amount: parseUnits("500", 18) },
				{ address: lpToken.address, amount: -parseUnits("500", 18) },
			]);
		});
	});
});
