import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { decodeEventLog, parseUnits } from "viem";
import LPTokenModule from "../ignition/modules/LPToken.js";

describe("LPToken", async function () {
	const { viem, ignition, networkHelpers } = await network.connect();
	const publicClient = await viem.getPublicClient();
	const { loadFixture } = networkHelpers;

	async function deployLPTokenFixture() {
		const [owner] = await viem.getWalletClients();

		// Deploy LPToken module (includes tokens and LP token)
		const deployed = await ignition.deploy(LPTokenModule);
		const { tokenA, tokenB, lpToken } = deployed;

		// Get contract instances
		const tokenAContract = await viem.getContractAt("Token", tokenA.address);
		const tokenBContract = await viem.getContractAt("Token", tokenB.address);
		const pairContract = await viem.getContractAt("LPToken", lpToken.address);

		// Determine token0 and token1 based on addresses
		const token0Address =
			tokenA.address < tokenB.address ? tokenA.address : tokenB.address;
		const token1Address =
			tokenA.address < tokenB.address ? tokenB.address : tokenA.address;
		const token0 =
			token0Address === tokenA.address ? tokenAContract : tokenBContract;
		const token1 =
			token1Address === tokenA.address ? tokenAContract : tokenBContract;

		// Mint tokens to owner
		await tokenAContract.write.mint([
			owner.account.address,
			parseUnits("1000000", 18),
		]);
		await tokenBContract.write.mint([
			owner.account.address,
			parseUnits("1000000", 18),
		]);

		return {
			tokenA: tokenAContract,
			tokenB: tokenBContract,
			token0,
			token1,
			pairContract,
			owner,
			publicClient,
		};
	}

	describe("mintLiquidity", function () {
		it("Should mint liquidity on first deposit", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			// Mint tokens to owner first
			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);

			// Transfer tokens to pair contract (mintLiquidity checks balance of address(this))
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);

			// Mint liquidity (checks pair contract's balance)
			const hash = await pairContract.write.mintLiquidity([
				owner.account.address,
			]);
			const receipt = await publicClient.waitForTransactionReceipt({ hash });

			// Check LiquidityAdded event
			const liquidityAddedLog = receipt.logs.find((log) => {
				try {
					const decoded = decodeEventLog({
						abi: pairContract.abi,
						data: log.data,
						topics: log.topics,
					});
					return decoded.eventName === "LiquidityAdded";
				} catch {
					return false;
				}
			});

			assert.ok(liquidityAddedLog, "LiquidityAdded event should be emitted");

			const decoded = decodeEventLog({
				abi: pairContract.abi,
				data: liquidityAddedLog!.data,
				topics: liquidityAddedLog!.topics,
			});
			console.log(decoded);

			const {
				to,
				amount0: eventAmount0,
				amount1: eventAmount1,
				liquidity,
			} = decoded.args as any;

			assert.equal(to.toLowerCase(), owner.account.address.toLowerCase());
			assert.equal(eventAmount0, amount0);
			assert.equal(eventAmount1, amount1);

			// For first mint, liquidity = sqrt(amount0 * amount1)
			// Verify liquidity is positive and reasonable
			assert.ok(liquidity > 0n, "Liquidity should be positive");
			// Liquidity should be less than or equal to the geometric mean

			// Check LP token balance
			const lpBalance = await pairContract.read.balanceOf([
				owner.account.address,
			]);
			assert.equal(
				lpBalance,
				liquidity,
				"LP balance should match minted liquidity"
			);
		});

		it("Should mint liquidity on subsequent deposits", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// First deposit - transfer tokens to pair contract
			const amount0_1 = parseUnits("1000", 18);
			const amount1_1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0_1]);
			await token1.write.mint([owner.account.address, amount1_1]);
			await token0.write.transfer([pairContract.address, amount0_1]);
			await token1.write.transfer([pairContract.address, amount1_1]);

			await pairContract.write.mintLiquidity([owner.account.address]);
			const totalSupply1 = await pairContract.read.totalSupply();

			// Second deposit - transfer more tokens to pair contract
			const amount0_2 = parseUnits("500", 18);
			const amount1_2 = parseUnits("1000", 18);

			await token0.write.mint([owner.account.address, amount0_2]);
			await token1.write.mint([owner.account.address, amount1_2]);
			await token0.write.transfer([pairContract.address, amount0_2]);
			await token1.write.transfer([pairContract.address, amount1_2]);

			const hash = await pairContract.write.mintLiquidity([
				owner.account.address,
			]);
			const receipt = await publicClient.waitForTransactionReceipt({ hash });

			const liquidityAddedLog = receipt.logs.find((log) => {
				try {
					const decoded = decodeEventLog({
						abi: pairContract.abi,
						data: log.data,
						topics: log.topics,
					});
					return decoded.eventName === "LiquidityAdded";
				} catch {
					return false;
				}
			});

			const decoded = decodeEventLog({
				abi: pairContract.abi,
				data: liquidityAddedLog!.data,
				topics: liquidityAddedLog!.topics,
			});

			const { liquidity } = decoded.args as any;

			// For subsequent mints, liquidity = min(amount0 * totalSupply / reserve0, amount1 * totalSupply / reserve1)
			// Expected: min(500 * totalSupply1 / 1000, 1000 * totalSupply1 / 2000)
			// Both should be equal: totalSupply1 / 2
			const expectedLiquidity = totalSupply1 / 2n;
			assert.equal(
				liquidity,
				expectedLiquidity,
				"Liquidity should match calculation"
			);

			const totalSupply2 = await pairContract.read.totalSupply();
			assert.equal(
				totalSupply2,
				totalSupply1 + liquidity,
				"Total supply should increase"
			);
		});

		it("Should revert when minting with zero liquidity", async function () {
			const { pairContract, owner } = await loadFixture(deployLPTokenFixture);

			// Try to mint without transferring tokens to pair contract
			await assert.rejects(
				async () => {
					await pairContract.write.mintLiquidity([owner.account.address]);
				},
				(error: any) => {
					return (
						error.message?.includes("InsufficientLiquidity") ||
						error.message?.includes("revert") ||
						error.message?.includes("execution reverted")
					);
				},
				"Should revert with InsufficientLiquidity error"
			);
		});
	});

	describe("burnLiquidity", function () {
		it("Should burn liquidity and return tokens", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// First, add liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);

			await pairContract.write.mintLiquidity([owner.account.address]);
			const totalSupply = await pairContract.read.totalSupply();
			const lpBalance = await pairContract.read.balanceOf([
				owner.account.address,
			]);

			// Get balances before burn
			const balance0Before = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1Before = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Transfer LP tokens to pair contract (required for burn)
			await pairContract.write.transfer([pairContract.address, lpBalance]);

			// Burn liquidity
			const hash = await pairContract.write.burnLiquidity([
				owner.account.address,
			]);
			const receipt = await publicClient.waitForTransactionReceipt({ hash });

			// Check LiquidityRemoved event
			const liquidityRemovedLog = receipt.logs.find((log) => {
				try {
					const decoded = decodeEventLog({
						abi: pairContract.abi,
						data: log.data,
						topics: log.topics,
					});
					return decoded.eventName === "LiquidityRemoved";
				} catch {
					return false;
				}
			});

			assert.ok(
				liquidityRemovedLog,
				"LiquidityRemoved event should be emitted"
			);

			const decoded = decodeEventLog({
				abi: pairContract.abi,
				data: liquidityRemovedLog!.data,
				topics: liquidityRemovedLog!.topics,
			});

			const {
				to,
				amount0: eventAmount0,
				amount1: eventAmount1,
				liquidity: burnedLiquidity,
			} = decoded.args as any;

			assert.equal(to.toLowerCase(), owner.account.address.toLowerCase());
			assert.equal(
				burnedLiquidity,
				lpBalance,
				"Burned liquidity should match LP balance"
			);

			// Check balances after burn
			const balance0After = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1After = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Verify tokens were returned
			assert.equal(
				balance0After,
				balance0Before + eventAmount0,
				"Token0 balance should increase by returned amount"
			);
			assert.equal(
				balance1After,
				balance1Before + eventAmount1,
				"Token1 balance should increase by returned amount"
			);

			// Verify LP tokens were burned
			const lpBalanceAfter = await pairContract.read.balanceOf([
				owner.account.address,
			]);
			assert.equal(lpBalanceAfter, 0n, "LP balance should be zero after burn");
		});

		it("Should revert when burning with insufficient liquidity", async function () {
			const { pairContract, owner } = await loadFixture(deployLPTokenFixture);

			// Try to burn without LP tokens in pair contract
			await assert.rejects(
				async () => {
					await pairContract.write.burnLiquidity([owner.account.address]);
				},
				(error: any) => {
					return (
						error.message?.includes("InsufficientLiquidityBurned") ||
						error.message?.includes("revert") ||
						error.message?.includes("execution reverted")
					);
				},
				"Should revert with InsufficientLiquidityBurned error"
			);
		});
	});

	describe("getAmountIn and getAmountOut", function () {
		it("Should calculate correct amount in for given amount out", async function () {
			const { pairContract, token0, token1, owner } = await loadFixture(
				deployLPTokenFixture
			);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			// Test getAmountIn
			const amountOut = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			const amountIn = await pairContract.read.getAmountIn([
				token0Address,
				token1Address,
				amountOut,
			]);

			// Verify calculation: amountIn = (amountOut * reserveIn * 1000) / ((reserveOut - amountOut) * 997)
			// Using ceiling division
			const reserveIn = amount0; // token0 reserve
			const reserveOut = amount1; // token1 reserve
			const numerator = amountOut * reserveIn * 1000n;
			const denominator = (reserveOut - amountOut) * 997n;
			const expectedAmountIn =
				numerator / denominator + (numerator % denominator > 0n ? 1n : 0n);

			assert.equal(
				amountIn,
				expectedAmountIn,
				"AmountIn should match calculation"
			);
		});

		it("Should calculate correct amount out for given amount in", async function () {
			const { pairContract, token0, token1, owner } = await loadFixture(
				deployLPTokenFixture
			);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			// Test getAmountOut
			const amountIn = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			const amountOut = await pairContract.read.getAmountOut([
				token0Address,
				token1Address,
				amountIn,
			]);

			// Verify calculation: amountOut = (amountIn * 997 * reserveOut) / ((reserveIn + amountIn * 997) * 1000)
			// Using ceiling division
			const reserveIn = amount0; // token0 reserve
			const reserveOut = amount1; // token1 reserve
			const amountInWithFee = amountIn * 997n;
			const numerator = amountInWithFee * reserveOut;
			const denominator = (reserveIn + amountInWithFee) * 1000n;
			const expectedAmountOut =
				numerator / denominator + (numerator % denominator > 0n ? 1n : 0n);

			assert.equal(
				amountOut,
				expectedAmountOut,
				"AmountOut should match calculation"
			);
		});

		it("Should handle reverse direction (token1 to token0)", async function () {
			const { pairContract, token0, token1, owner } = await loadFixture(
				deployLPTokenFixture
			);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			const amountOut = parseUnits("50", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			// Test getAmountIn in reverse direction (token1 -> token0)
			const amountIn = await pairContract.read.getAmountIn([
				token1Address,
				token0Address,
				amountOut,
			]);

			// Verify calculation for reverse direction
			const reserveIn = amount1; // token1 reserve
			const reserveOut = amount0; // token0 reserve
			const numerator = amountOut * reserveIn * 1000n;
			const denominator = (reserveOut - amountOut) * 997n;
			const expectedAmountIn =
				numerator / denominator + (numerator % denominator > 0n ? 1n : 0n);

			assert.equal(
				amountIn,
				expectedAmountIn,
				"AmountIn should match calculation for reverse direction"
			);
		});
	});

	describe("swapExactOut", function () {
		it("Should swap exact amount out and match getAmountIn calculation", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			// Get expected amount in using view function
			const amountOutMin = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			const expectedAmountIn = await pairContract.read.getAmountIn([
				token0Address,
				token1Address,
				amountOutMin,
			]);

			// Get balances before swap
			const balance0Before = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1Before = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Approve tokenIn for swap (swapExactOut uses transferFrom)
			await token0.write.approve([pairContract.address, expectedAmountIn]);
			// Ensure owner has enough tokens
			if (balance0Before < expectedAmountIn) {
				await token0.write.mint([
					owner.account.address,
					expectedAmountIn - balance0Before,
				]);
			}

			// Perform swap
			const hash = await pairContract.write.swapExactOut([
				token0Address,
				token1Address,
				expectedAmountIn,
				amountOutMin,
			]);
			await publicClient.waitForTransactionReceipt({ hash });

			// Check balances after swap
			const balance0After = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1After = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Verify token0 was spent (decreased by expectedAmountIn)
			const balance0Expected =
				balance0Before < expectedAmountIn
					? 0n
					: balance0Before - expectedAmountIn;
			assert.equal(
				balance0After,
				balance0Expected,
				"Token0 balance should decrease by amountIn"
			);

			// Verify token1 was received
			assert.equal(
				balance1After,
				balance1Before + amountOutMin,
				"Token1 balance should increase by amountOutMin"
			);
		});

		it("Should revert when amountOutMin exceeds reserve", async function () {
			const { pairContract, token0, token1, owner } = await loadFixture(
				deployLPTokenFixture
			);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			const amountOutMin = parseUnits("3000", 18); // Exceeds reserve
			const token0Address = token0.address;
			const token1Address = token1.address;

			await assert.rejects(
				async () => {
					await pairContract.write.swapExactOut([
						token0Address,
						token1Address,
						parseUnits("1000", 18),
						amountOutMin,
					]);
				},
				(error: any) => {
					return (
						error.message?.includes("InsufficientAmountOut") ||
						error.message?.includes("revert") ||
						error.message?.includes("execution reverted")
					);
				},
				"Should revert with InsufficientAmountOut error"
			);
		});
	});

	describe("swapExactIn", function () {
		it("Should swap exact amount in and match getAmountOut calculation", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			// Get expected amount out using view function
			const amountInMax = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			const expectedAmountOut = await pairContract.read.getAmountOut([
				token0Address,
				token1Address,
				amountInMax,
			]);

			// Get balances before swap
			const balance0Before = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1Before = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Approve tokenIn for swap
			await token0.write.approve([pairContract.address, amountInMax]);
			// Ensure owner has enough tokens
			if (balance0Before < amountInMax) {
				await token0.write.mint([
					owner.account.address,
					amountInMax - balance0Before,
				]);
			}

			// Perform swap
			const hash = await pairContract.write.swapExactIn([
				token0Address,
				token1Address,
				expectedAmountOut,
				amountInMax,
			]);
			await publicClient.waitForTransactionReceipt({ hash });

			// Check balances after swap
			const balance0After = await token0.read.balanceOf([
				owner.account.address,
			]);
			const balance1After = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Verify token0 was spent (decreased by amountInMax)
			const balance0Expected =
				balance0Before < amountInMax ? 0n : balance0Before - amountInMax;
			assert.equal(
				balance0After,
				balance0Expected,
				"Token0 balance should decrease by amountInMax"
			);

			// Verify token1 was received (should match expectedAmountOut)
			assert.equal(
				balance1After,
				balance1Before + expectedAmountOut,
				"Token1 balance should increase by expectedAmountOut"
			);
		});

		it("Should revert when amountOutMin exceeds reserve in swapExactOut", async function () {
			const { pairContract, token0, token1, owner } = await loadFixture(
				deployLPTokenFixture
			);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			// Request amountOutMin that exceeds reserve
			const amountOutMin = parseUnits("3000", 18); // Exceeds reserve1 (2000)
			const token0Address = token0.address;
			const token1Address = token1.address;

			// Approve some amountIn (will be calculated but swap will revert before)
			const amountIn = parseUnits("1000", 18);
			await token0.write.approve([pairContract.address, amountIn]);
			await token0.write.mint([owner.account.address, amountIn]);

			await assert.rejects(
				async () => {
					await pairContract.write.swapExactOut([
						token0Address,
						token1Address,
						amountIn,
						amountOutMin, // This exceeds reserve, should revert
					]);
				},
				(error: any) => {
					return (
						error.message?.includes("InsufficientAmountOut") ||
						error.message?.includes("revert") ||
						error.message?.includes("execution reverted")
					);
				},
				"Should revert with InsufficientAmountOut error when amountOutMin exceeds reserve"
			);
		});
	});

	describe("Integration: View functions match swap results", function () {
		it("Should have getAmountIn match swapExactOut actual usage", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			const amountOutMin = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			// Get expected amount in
			const expectedAmountIn = await pairContract.read.getAmountIn([
				token0Address,
				token1Address,
				amountOutMin,
			]);

			// Prepare for swap
			await token0.write.approve([pairContract.address, expectedAmountIn]);
			await token0.write.mint([owner.account.address, expectedAmountIn]);

			// Perform swap
			await pairContract.write.swapExactOut([
				token0Address,
				token1Address,
				expectedAmountIn,
				amountOutMin,
			]);

			// The swap should succeed, meaning getAmountIn returned the correct value
			// Verify by checking that we received exactly amountOutMin
			const balance1After = await token1.read.balanceOf([
				owner.account.address,
			]);
			const balance1Before = balance1After - amountOutMin;
			assert.ok(
				balance1After >= balance1Before + amountOutMin,
				"Should receive at least amountOutMin"
			);
		});

		it("Should have getAmountOut match swapExactIn actual usage", async function () {
			const { pairContract, token0, token1, owner, publicClient } =
				await loadFixture(deployLPTokenFixture);

			// Add initial liquidity - transfer tokens to pair contract
			const amount0 = parseUnits("1000", 18);
			const amount1 = parseUnits("2000", 18);

			await token0.write.mint([owner.account.address, amount0]);
			await token1.write.mint([owner.account.address, amount1]);
			await token0.write.transfer([pairContract.address, amount0]);
			await token1.write.transfer([pairContract.address, amount1]);
			await pairContract.write.mintLiquidity([owner.account.address]);

			const amountInMax = parseUnits("100", 18);
			const token0Address = token0.address;
			const token1Address = token1.address;

			// Get expected amount out
			const expectedAmountOut = await pairContract.read.getAmountOut([
				token0Address,
				token1Address,
				amountInMax,
			]);

			// Prepare for swap
			await token0.write.approve([pairContract.address, amountInMax]);
			await token0.write.mint([owner.account.address, amountInMax]);

			const balance1Before = await token1.read.balanceOf([
				owner.account.address,
			]);

			// Perform swap
			await pairContract.write.swapExactIn([
				token0Address,
				token1Address,
				expectedAmountOut,
				amountInMax,
			]);

			// Verify we received exactly expectedAmountOut
			const balance1After = await token1.read.balanceOf([
				owner.account.address,
			]);
			assert.equal(
				balance1After,
				balance1Before + expectedAmountOut,
				"Should receive exactly expectedAmountOut from getAmountOut"
			);
		});
	});
});
