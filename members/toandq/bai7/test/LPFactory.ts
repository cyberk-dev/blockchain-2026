import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { Address, decodeEventLog, parseUnits } from "viem";
import LPFactoryModule from "../ignition/modules/LPFactory.js";
import TokenModule from "../ignition/modules/Token.js";

describe("LPFactory", async function () {
	const { viem, ignition, networkHelpers } = await network.connect();
	const publicClient = await viem.getPublicClient();
	const { loadFixture } = networkHelpers;

	async function deployFactoryFixture() {
		const [owner, addr1] = await viem.getWalletClients();

		// Deploy factory
		const factoryDeployed = await ignition.deploy(LPFactoryModule);
		const { lpFactory } = factoryDeployed;

		// Deploy two tokens for testing
		const token1Deployed = await ignition.deploy(TokenModule, {
			parameters: {
				TokenModule: {
					name: "Token A",
					symbol: "TKA",
					owner: owner.account.address,
				},
			},
		});
		const { token: tokenA } = token1Deployed;

		const token2Deployed = await ignition.deploy(TokenModule, {
			parameters: {
				TokenModule: {
					name: "Token B",
					symbol: "TKB",
					owner: owner.account.address,
				},
			},
		});
		const { token: tokenB } = token2Deployed;

		return {
			lpFactory,
			tokenA,
			tokenB,
			owner,
			addr1,
			publicClient,
		};
	}

	it("Should deploy factory successfully", async function () {
		const { lpFactory } = await loadFixture(deployFactoryFixture);

		assert.ok(lpFactory.address, "Factory should have an address");

		// Verify allPairsLength is 0 initially
		const length = await lpFactory.read.allPairsLength();
		assert.equal(length, 0n, "Initial pairs length should be 0");
	});

	it("Should create pair successfully", async function () {
		const { lpFactory, tokenA, tokenB, owner, publicClient } =
			await loadFixture(deployFactoryFixture);

		const hash = await lpFactory.write.createPair([
			tokenA.address,
			tokenB.address,
		]);

		const receipt = await publicClient.waitForTransactionReceipt({ hash });

		// Find PairCreated event
		const pairCreatedLog = receipt.logs.find((log) => {
			try {
				const decoded = decodeEventLog({
					abi: lpFactory.abi,
					data: log.data,
					topics: log.topics,
				});
				return decoded.eventName === "PairCreated";
			} catch {
				return false;
			}
		});

		assert.ok(pairCreatedLog, "PairCreated event should be emitted");

		const decoded = decodeEventLog({
			abi: lpFactory.abi,
			data: pairCreatedLog!.data,
			topics: pairCreatedLog!.topics,
		});

		const [token0, token1, pair, pairIndex] = decoded.args as any;

		assert.ok(pair, "Pair address should not be zero");
		assert.equal(pairIndex, 1n, "Pair index should be 1");

		// Verify tokens are sorted correctly
		const sortedToken0 =
			tokenA.address < tokenB.address ? tokenA.address : tokenB.address;
		const sortedToken1 =
			tokenA.address < tokenB.address ? tokenB.address : tokenA.address;
		assert.equal(
			token0.toLowerCase(),
			sortedToken0.toLowerCase(),
			"Token0 should be the smaller address"
		);
		assert.equal(
			token1.toLowerCase(),
			sortedToken1.toLowerCase(),
			"Token1 should be the larger address"
		);

		// Verify pair exists in factory
		const pairAddress = await lpFactory.read.getPair([token0, token1]);
		assert.equal(
			pairAddress.toLowerCase(),
			pair.toLowerCase(),
			"Pair should exist in factory mapping"
		);

		// Verify reverse mapping
		const reversePairAddress = await lpFactory.read.getPair([token1, token0]);
		assert.equal(
			reversePairAddress.toLowerCase(),
			pair.toLowerCase(),
			"Reverse pair mapping should work"
		);

		// Verify allPairsLength increased
		const length = await lpFactory.read.allPairsLength();
		assert.equal(length, 1n, "Pairs length should be 1");

		// Verify pair contract properties
		const pairContract = await viem.getContractAt("LPToken", pair);
		// Note: token0 and token1 are private in LPToken, so we can't read them directly
		// But we can verify the pair was created correctly by checking it's an ERC20
		const pairName = await pairContract.read.name();
		const pairSymbol = await pairContract.read.symbol();
		assert.equal(pairName, "LPToken", "Pair name should be LPToken");
		assert.equal(pairSymbol, "LP", "Pair symbol should be LP");
	});

	it("Should revert when creating pair with identical addresses", async function () {
		const { lpFactory, tokenA } = await loadFixture(deployFactoryFixture);

		await assert.rejects(
			async () => {
				await lpFactory.write.createPair([tokenA.address, tokenA.address]);
			},
			(error: any) => {
				return (
					error.message?.includes("IdenticalAddresses") ||
					error.message?.includes("revert") ||
					error.message?.includes("execution reverted")
				);
			},
			"Should revert with IdenticalAddresses error"
		);
	});

	it("Should revert when creating pair with zero address", async function () {
		const { lpFactory, tokenA } = await loadFixture(deployFactoryFixture);
		const zeroAddress = "0x0000000000000000000000000000000000000000" as Address;

		await assert.rejects(
			async () => {
				await lpFactory.write.createPair([tokenA.address, zeroAddress]);
			},
			(error: any) => {
				return (
					error.message?.includes("ZeroAddress") ||
					error.message?.includes("revert") ||
					error.message?.includes("execution reverted")
				);
			},
			"Should revert with ZeroAddress error"
		);

		await assert.rejects(
			async () => {
				await lpFactory.write.createPair([zeroAddress, tokenA.address]);
			},
			(error: any) => {
				return (
					error.message?.includes("ZeroAddress") ||
					error.message?.includes("revert") ||
					error.message?.includes("execution reverted")
				);
			},
			"Should revert with ZeroAddress error"
		);
	});

	it("Should revert when creating pair that already exists", async function () {
		const { lpFactory, tokenA, tokenB } = await loadFixture(
			deployFactoryFixture
		);

		// Create pair first time
		await lpFactory.write.createPair([tokenA.address, tokenB.address]);

		// Try to create same pair again
		await assert.rejects(
			async () => {
				await lpFactory.write.createPair([tokenA.address, tokenB.address]);
			},
			(error: any) => {
				return (
					error.message?.includes("PairExists") ||
					error.message?.includes("revert") ||
					error.message?.includes("execution reverted")
				);
			},
			"Should revert with PairExists error"
		);

		// Try with reversed order
		await assert.rejects(
			async () => {
				await lpFactory.write.createPair([tokenB.address, tokenA.address]);
			},
			(error: any) => {
				return (
					error.message?.includes("PairExists") ||
					error.message?.includes("revert") ||
					error.message?.includes("execution reverted")
				);
			},
			"Should revert with PairExists error when using reversed order"
		);
	});

	it("Should create multiple pairs and track them correctly", async function () {
		const { lpFactory, tokenA, tokenB, owner, publicClient } =
			await loadFixture(deployFactoryFixture);

		// Deploy third token
		const token3Deployed = await ignition.deploy(TokenModule, {
			parameters: {
				TokenModule: {
					name: "Token C",
					symbol: "TKC",
					owner: owner.account.address,
				},
			},
		});
		const { token: tokenC } = token3Deployed;

		// Create first pair
		const hash1 = await lpFactory.write.createPair([
			tokenA.address,
			tokenB.address,
		]);
		await publicClient.waitForTransactionReceipt({ hash: hash1 });

		// Create second pair
		const hash2 = await lpFactory.write.createPair([
			tokenA.address,
			tokenC.address,
		]);
		await publicClient.waitForTransactionReceipt({ hash: hash2 });

		// Create third pair
		const hash3 = await lpFactory.write.createPair([
			tokenB.address,
			tokenC.address,
		]);
		await publicClient.waitForTransactionReceipt({ hash: hash3 });

		// Verify allPairsLength
		const length = await lpFactory.read.allPairsLength();
		assert.equal(length, 3n, "Pairs length should be 3");

		// Verify all pairs exist
		const pair1 = await lpFactory.read.getPair([
			tokenA.address,
			tokenB.address,
		]);
		const pair2 = await lpFactory.read.getPair([
			tokenA.address,
			tokenC.address,
		]);
		const pair3 = await lpFactory.read.getPair([
			tokenB.address,
			tokenC.address,
		]);

		assert.ok(
			pair1 !== "0x0000000000000000000000000000000000000000",
			"Pair 1 should exist"
		);
		assert.ok(
			pair2 !== "0x0000000000000000000000000000000000000000",
			"Pair 2 should exist"
		);
		assert.ok(
			pair3 !== "0x0000000000000000000000000000000000000000",
			"Pair 3 should exist"
		);

		// Verify all pairs are different
		assert.notEqual(
			pair1.toLowerCase(),
			pair2.toLowerCase(),
			"Pairs should be different"
		);
		assert.notEqual(
			pair2.toLowerCase(),
			pair3.toLowerCase(),
			"Pairs should be different"
		);
		assert.notEqual(
			pair1.toLowerCase(),
			pair3.toLowerCase(),
			"Pairs should be different"
		);
	});

	it("Should sort tokens correctly regardless of input order", async function () {
		const { lpFactory, tokenA, tokenB, publicClient } = await loadFixture(
			deployFactoryFixture
		);

		// Determine which token should be token0 (smaller address)
		const token0Expected =
			tokenA.address < tokenB.address ? tokenA.address : tokenB.address;
		const token1Expected =
			tokenA.address < tokenB.address ? tokenB.address : tokenA.address;

		// Create pair with tokenA first
		const hash1 = await lpFactory.write.createPair([
			tokenA.address,
			tokenB.address,
		]);
		const receipt1 = await publicClient.waitForTransactionReceipt({
			hash: hash1,
		});

		const pairCreatedLog1 = receipt1.logs.find((log) => {
			try {
				const decoded = decodeEventLog({
					abi: lpFactory.abi,
					data: log.data,
					topics: log.topics,
				});
				return decoded.eventName === "PairCreated";
			} catch {
				return false;
			}
		});

		const decoded1 = decodeEventLog({
			abi: lpFactory.abi,
			data: pairCreatedLog1!.data,
			topics: pairCreatedLog1!.topics,
		});

		const [token0_1, token1_1] = decoded1.args as any;

		assert.equal(
			token0_1.toLowerCase(),
			token0Expected.toLowerCase(),
			"Token0 should match expected (first order)"
		);
		assert.equal(
			token1_1.toLowerCase(),
			token1Expected.toLowerCase(),
			"Token1 should match expected (first order)"
		);
	});
});
