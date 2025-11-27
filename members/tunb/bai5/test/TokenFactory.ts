import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, formatEther, getAddress } from "viem";

/**
 * Test suite for TokenFactory
 * Tests token creation with ETH fee collection
 */
describe("TokenFactory", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  const [owner, creator] = walletClients;

  const creationFee = parseEther("0.01"); // 0.01 ETH
  const tokenSlope = 1000n;
  const tokenInitialPrice = parseEther("0.001");
  const tokenFeeBps = 500n;

  it("should deploy factory with correct parameters", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    const fee = await factory.read.creationFee();
    const recipient = await factory.read.feeRecipient();

    assert.equal(fee, creationFee, "Creation fee should match");
    assert.equal(
      getAddress(recipient),
      getAddress(owner.account.address),
      "Fee recipient should match"
    );
  });

  it("should create token and emit TokenCreated event", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    const tokenName = "MyToken";
    const tokenSymbol = "MTK";

    // Get owner balance before
    const ownerBalanceBefore = await publicClient.getBalance({
      address: owner.account.address,
    });

    // Create token with exact fee
    const txHash = await creator.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createToken",
      args: [tokenName, tokenSymbol, tokenSlope, tokenInitialPrice, tokenFeeBps],
      value: creationFee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // *** PARSE TokenCreated EVENT FROM RECEIPT ***
    const events = await publicClient.getContractEvents({
      address: factory.address,
      abi: factory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    // Verify event was emitted
    assert.equal(events.length, 1, "Should emit exactly one TokenCreated event");

    // Verify event parameters
    const event = events[0];
    console.log("\n=== TokenCreated Event ===");
    console.log("Token Address:", event.args.tokenAddress);
    console.log("Creator:", event.args.creator);
    console.log("Name:", event.args.name);
    console.log("Symbol:", event.args.symbol);
    console.log("Creation Fee:", formatEther(event.args.creationFee!), "ETH");

    // Use getAddress for checksum comparison
    assert.equal(
      getAddress(event.args.creator!),
      getAddress(creator.account.address),
      "Event creator should match"
    );
    assert.equal(event.args.name, tokenName, "Event name should match");
    assert.equal(event.args.symbol, tokenSymbol, "Event symbol should match");
    assert.equal(
      event.args.creationFee,
      creationFee,
      "Event creationFee should match"
    );

    // Verify token address is valid
    assert.ok(
      event.args.tokenAddress !== "0x0000000000000000000000000000000000000000",
      "Token address should not be zero"
    );

    // Verify deployed tokens count
    const count = await factory.read.getDeployedTokensCount();
    assert.equal(count, 1n, "Should have 1 deployed token");

    // Verify token in array
    const deployedTokens = await factory.read.getDeployedTokens();
    assert.equal(
      getAddress(deployedTokens[0]),
      getAddress(event.args.tokenAddress!),
      "Deployed token address should match event"
    );

    // Verify fee was collected
    const ownerBalanceAfter = await publicClient.getBalance({
      address: owner.account.address,
    });
    const feeReceived = ownerBalanceAfter - ownerBalanceBefore;
    assert.equal(feeReceived, creationFee, "Owner should receive exact creation fee");
  });

  it("should transfer token ownership to creator", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    const txHash = await creator.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createToken",
      args: ["TestToken", "TT", tokenSlope, tokenInitialPrice, tokenFeeBps],
      value: creationFee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Get token address from event
    const events = await publicClient.getContractEvents({
      address: factory.address,
      abi: factory.abi,
      eventName: "TokenCreated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    const tokenAddress = events[0].args.tokenAddress!;

    // Get Token contract at deployed address
    const token = await viem.getContractAt("Token", tokenAddress);

    // Verify ownership transferred to creator
    const tokenOwner = await token.read.owner();
    assert.equal(
      getAddress(tokenOwner),
      getAddress(creator.account.address),
      "Token owner should be creator"
    );
  });

  it("should revert with insufficient creation fee", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    try {
      await creator.writeContract({
        address: factory.address,
        abi: factory.abi,
        functionName: "createToken",
        args: ["TestToken", "TT", tokenSlope, tokenInitialPrice, tokenFeeBps],
        value: creationFee - 1n, // 1 wei short
      });
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InsufficientCreationFee"),
        "Should revert with InsufficientCreationFee"
      );
    }
  });

  it("should refund excess ETH", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    const excessAmount = parseEther("0.005");
    const paymentAmount = creationFee + excessAmount;

    // Get creator balance before
    const creatorBalanceBefore = await publicClient.getBalance({
      address: creator.account.address,
    });

    const txHash = await creator.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createToken",
      args: ["TestToken", "TT", tokenSlope, tokenInitialPrice, tokenFeeBps],
      value: paymentAmount,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Calculate gas cost
    const gasUsed = receipt.gasUsed;
    const tx = await publicClient.getTransaction({ hash: txHash });
    const gasCost = gasUsed * tx.gasPrice!;

    // Get creator balance after
    const creatorBalanceAfter = await publicClient.getBalance({
      address: creator.account.address,
    });

    // Creator should have paid: creationFee + gas
    const expectedBalanceChange = creationFee + gasCost;
    const actualBalanceChange = creatorBalanceBefore - creatorBalanceAfter;

    console.log("\n=== Refund Verification ===");
    console.log("Payment:", formatEther(paymentAmount), "ETH");
    console.log("Creation Fee:", formatEther(creationFee), "ETH");
    console.log("Gas Cost:", formatEther(gasCost), "ETH");
    console.log("Actual spent:", formatEther(actualBalanceChange), "ETH");

    // Allow small variance for gas estimation
    assert.ok(
      actualBalanceChange >= expectedBalanceChange - parseEther("0.0001") &&
        actualBalanceChange <= expectedBalanceChange + parseEther("0.0001"),
      "Creator should only pay creation fee + gas (excess refunded)"
    );
  });

  it("should allow owner to update creation fee", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    const newFee = parseEther("0.02");

    const txHash = await owner.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "setCreationFee",
      args: [newFee],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // Parse CreationFeeUpdated event
    const events = await publicClient.getContractEvents({
      address: factory.address,
      abi: factory.abi,
      eventName: "CreationFeeUpdated",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    assert.equal(events.length, 1, "Should emit CreationFeeUpdated event");
    assert.equal(events[0].args.newFee, newFee, "Event should contain new fee");

    // Verify state change
    const currentFee = await factory.read.creationFee();
    assert.equal(currentFee, newFee, "Creation fee should be updated");
  });

  it("should create multiple tokens", async function () {
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      owner.account.address,
    ]);

    // Create first token
    await creator.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createToken",
      args: ["Token1", "T1", tokenSlope, tokenInitialPrice, tokenFeeBps],
      value: creationFee,
    });

    // Create second token
    await creator.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createToken",
      args: ["Token2", "T2", tokenSlope, tokenInitialPrice, tokenFeeBps],
      value: creationFee,
    });

    // Verify count
    const count = await factory.read.getDeployedTokensCount();
    assert.equal(count, 2n, "Should have 2 deployed tokens");

    // Verify all tokens are different addresses
    const tokens = await factory.read.getDeployedTokens();
    assert.notEqual(
      getAddress(tokens[0]),
      getAddress(tokens[1]),
      "Token addresses should be different"
    );
  });
});
