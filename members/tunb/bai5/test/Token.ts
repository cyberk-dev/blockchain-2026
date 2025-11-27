import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, formatEther, getAddress } from "viem";

/**
 * Test suite for Token with Linear Bonding Curve
 *
 * Bonding Curve Formula: y = x/a + b (linear)
 * Cost Integral: Cost(s, m) = m*(1 + 2ab + m + 2s) / (2a)
 *
 * WolframAlpha Proof (generic): https://www.wolframalpha.com/input?i=integral+of+x%2Fa+%2B+b+from+s+to+s%2Bm
 * WolframAlpha Proof (test params: a=1000, b=1e15, m=1, s=0):
 *   https://www.wolframalpha.com/input?i=1*%281+%2B+2*1000*1e15+%2B+1+%2B+2*0%29+%2F+%282*1000%29
 *   Result: 1000000000000001 wei ≈ 0.001 ETH
 */
describe("Token with Linear Bonding Curve", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const [owner, buyer] = walletClients;

  // Parameters that produce meaningful costs and fees
  // slope (a) = 1000 - lower value = faster price increase
  // initialPrice (b) = 0.001 ETH - base price
  const slope = 1000n;
  const initialPrice = parseEther("0.001"); // 1e15 wei
  const feeBps = 500n; // 5% transaction fee
  const BPS_DENOMINATOR = 10000n;

  it("should calculate cost correctly for first token", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    // For m=1 token, s=0:
    // cost = m * (1 + 2*a*b + m + 2*s) / (2*a)
    // cost = 1 * (1 + 2*1000*1e15 + 1 + 0) / 2000
    // cost ≈ 2e18 / 2000 = 1e15 = 0.001 ETH
    const tokenAmount = 1n;
    const cost = await token.read.calculateCost([tokenAmount, 0n]);

    console.log("Token amount:", tokenAmount.toString());
    console.log("Calculated cost:", cost.toString(), "wei");
    console.log("Calculated cost:", formatEther(cost), "ETH");

    // Cost should be positive
    assert.ok(cost > 0n, "Cost should be positive");
    // Should be around 0.001 ETH (1e15 wei) since b dominates
    assert.ok(cost >= parseEther("0.0001"), "Cost should be at least 0.0001 ETH");
    assert.ok(cost < parseEther("1"), "Cost should be less than 1 ETH");
  });

  it("should calculate cost correctly with existing supply", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    // With slope=1000, need large supply to see difference
    // Formula: cost = m * (1 + 2*a*b + m + 2*s) / (2*a)
    // The 2*s term needs to be significant compared to 2*a*b (= 2*1000*1e15 = 2e18)
    // So supply needs to be around 1e18 to see meaningful difference
    
    const tokenAmount = 1n;
    const largeSupply = 10n ** 18n; // 1e18 supply
    const cost = await token.read.calculateCost([tokenAmount, largeSupply]);
    const costAtZero = await token.read.calculateCost([tokenAmount, 0n]);

    console.log("Cost at supply=0:", formatEther(costAtZero), "ETH");
    console.log("Cost at supply=1e18:", formatEther(cost), "ETH");

    // Cost with higher supply should be higher (bonding curve property)
    assert.ok(cost > costAtZero, "Cost should increase with supply");
  });

  it("should buy tokens and emit TokensPurchased event", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    const tokenAmount = 1n; // Buy 1 token
    const cost = await token.read.calculateCost([tokenAmount, 0n]);
    const fee = (cost * feeBps) / BPS_DENOMINATOR;
    const totalRequired = cost + fee;

    console.log("Cost:", formatEther(cost), "ETH");
    console.log("Fee (5%):", formatEther(fee), "ETH");
    console.log("Total required:", formatEther(totalRequired), "ETH");

    // Add extra ETH for safety
    const paymentAmount = totalRequired + parseEther("0.01");

    // Get owner balance before (fee recipient)
    const ownerBalanceBefore = await publicClient.getBalance({
      address: owner.account.address,
    });

    // Buy tokens
    const txHash = await buyer.writeContract({
      address: token.address,
      abi: token.abi,
      functionName: "buyToken",
      args: [tokenAmount],
      value: paymentAmount,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // *** PARSE EVENTS FROM RECEIPT - KEY REQUIREMENT ***
    const events = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "TokensPurchased",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    // Verify event was emitted
    assert.equal(events.length, 1, "Should emit exactly one TokensPurchased event");

    // Verify event parameters (use getAddress for checksum comparison)
    const event = events[0];
    console.log("\n=== TokensPurchased Event ===");
    console.log("Buyer:", event.args.buyer);
    console.log("Token Amount:", event.args.tokenAmount!.toString());
    console.log("ETH Paid:", formatEther(event.args.ethPaid!), "ETH");
    console.log("Fee Amount:", formatEther(event.args.feeAmount!), "ETH");

    assert.equal(
      getAddress(event.args.buyer!),
      getAddress(buyer.account.address),
      "Event buyer should match"
    );
    assert.equal(
      event.args.tokenAmount,
      tokenAmount,
      "Event tokenAmount should match"
    );
    assert.equal(
      event.args.ethPaid,
      paymentAmount,
      "Event ethPaid should match payment"
    );
    assert.equal(event.args.feeAmount, fee, "Event feeAmount should match");

    // Verify token balance (1 token = 1 * 10^18 with decimals)
    const balance = await token.read.balanceOf([buyer.account.address]);
    const expectedBalance = tokenAmount * 10n ** 18n;
    console.log("\nBuyer token balance:", formatEther(balance));
    assert.equal(balance, expectedBalance, "Token balance should match");

    // Verify fee was collected (owner received fee > 0)
    const ownerBalanceAfter = await publicClient.getBalance({
      address: owner.account.address,
    });
    const feeReceived = ownerBalanceAfter - ownerBalanceBefore;
    console.log("Fee received by owner:", formatEther(feeReceived), "ETH");
    assert.ok(feeReceived >= fee, "Owner should have received fee");
  });

  it("should buy multiple tokens correctly", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    const tokenAmount = 10n; // Buy 10 tokens
    const cost = await token.read.calculateCost([tokenAmount, 0n]);
    const fee = (cost * feeBps) / BPS_DENOMINATOR;
    const totalRequired = cost + fee;

    console.log("Cost for 10 tokens:", formatEther(cost), "ETH");

    const paymentAmount = totalRequired + parseEther("0.01");

    const txHash = await buyer.writeContract({
      address: token.address,
      abi: token.abi,
      functionName: "buyToken",
      args: [tokenAmount],
      value: paymentAmount,
    });

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Verify balance
    const balance = await token.read.balanceOf([buyer.account.address]);
    const expectedBalance = tokenAmount * 10n ** 18n;
    assert.equal(balance, expectedBalance, "Should have 10 tokens");

    // Verify totalSold
    const totalSold = await token.read.totalSold();
    assert.equal(totalSold, tokenAmount, "totalSold should be 10");
  });

  it("should revert with insufficient payment", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    const tokenAmount = 1n;
    const cost = await token.read.calculateCost([tokenAmount, 0n]);
    const fee = (cost * feeBps) / BPS_DENOMINATOR;
    const totalRequired = cost + fee;

    // Try to buy with insufficient ETH
    try {
      await buyer.writeContract({
        address: token.address,
        abi: token.abi,
        functionName: "buyToken",
        args: [tokenAmount],
        value: totalRequired - 1n, // 1 wei short
      });
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InsufficientPayment"),
        "Should revert with InsufficientPayment"
      );
    }
  });

  it("should revert with zero amount", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    try {
      await buyer.writeContract({
        address: token.address,
        abi: token.abi,
        functionName: "buyToken",
        args: [0n],
        value: parseEther("1"),
      });
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("AmountZero"),
        "Should revert with AmountZero"
      );
    }
  });

  it("should allow owner to update fee recipient", async function () {
    const token = await viem.deployContract("Token", [
      "TestToken",
      "TT",
      slope,
      initialPrice,
      feeBps,
      owner.account.address,
    ]);

    const newRecipient = buyer.account.address;

    const txHash = await owner.writeContract({
      address: token.address,
      abi: token.abi,
      functionName: "setFeeRecipient",
      args: [newRecipient],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Parse FeeRecipientUpdated event
    const events = await publicClient.getContractEvents({
      address: token.address,
      abi: token.abi,
      eventName: "FeeRecipientUpdated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(events.length, 1, "Should emit FeeRecipientUpdated event");

    // Use getAddress for checksum comparison
    assert.equal(
      getAddress(events[0].args.newRecipient!),
      getAddress(newRecipient),
      "Event should contain new recipient"
    );

    // Verify state change
    const currentRecipient = await token.read.feeRecipient();
    assert.equal(
      getAddress(currentRecipient),
      getAddress(newRecipient),
      "Fee recipient should be updated"
    );
  });
});
