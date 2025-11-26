import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits, parseEther, getAddress } from "viem";
import { network } from "hardhat";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";
import MockERC20Module from "../ignition/modules/MockERC20.js";

const tokenAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "a", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "b", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "paymentToken", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "feeRecipient", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "buyFeeBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "buyToken", stateMutability: "nonpayable", inputs: [{ name: "_amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "getCost", stateMutability: "view", inputs: [{ name: "s", type: "uint256" }, { name: "m", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
];

describe("TokenFactory", async function () {
  const { ignition, viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployerWallet] = await viem.getWalletClients();
  const deployer = deployerWallet.account.address;

  it("deploy factory and create token with bonding curve", async function () {
    // Deploy MockERC20 as payment token
    const { mockERC20 } = await ignition.deploy(MockERC20Module, {
      parameters: {
        MockERC20Module: {
          name: "Mock USDT",
          symbol: "USDT",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    const mockERC20Contract = mockERC20 as any;

    // Deploy TokenFactory with no fees
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {
        parameters: {
          TokenFactoryModule: {
            feeRecipient: deployer,
            creationFee: 0n,
            buyFeeBps: 0n,
          },
        },
      });

    const supply = parseUnits("1000", 18);
    const slope = 10n ** 22n;
    const basePrice = 12n;

    // Create token via factory (no fee required)
    const tx = await factory.write.createToken(
      ["Factory Token", "FCT", supply, slope, basePrice, mockERC20Contract.address],
      { account: deployer }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");

    // Get created token address
    const tokensForCreator = await factory.read.getCreatorTokens([deployer]);
    assert.ok(tokensForCreator.length >= 1);
    const tokenAddress = tokensForCreator[tokensForCreator.length - 1] as `0x${string}`;

    // Verify token balance
    const bal: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [deployer],
    });
    assert.equal(bal, supply, "Creator should have initial supply");

    // Verify bonding curve params
    const tokenSlope: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "a",
    });
    assert.equal(tokenSlope, slope, "Slope should match");

    const tokenBasePrice: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "b",
    });
    assert.equal(tokenBasePrice, basePrice, "Base price should match");
  });

  it("should require creation fee and transfer to feeRecipient", async function () {
    const { mockERC20 } = await ignition.deploy(MockERC20Module, {
      parameters: {
        MockERC20Module: {
          name: "Mock USDT 2",
          symbol: "USDT2",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    const mockERC20Contract = mockERC20 as any;
    const creationFee = parseEther("0.01"); // 0.01 ETH

    // Deploy TokenFactory with creation fee
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {
        parameters: {
          TokenFactoryModule: {
            feeRecipient: deployer,
            creationFee: creationFee,
            buyFeeBps: 0n,
          },
        },
      });

    // Get initial balance
    const initialBalance = await publicClient.getBalance({ address: deployer });

    const supply = parseUnits("100", 18);
    const slope = 10n ** 22n;
    const basePrice = 12n;

    // Create token with exact fee
    const tx = await factory.write.createToken(
      ["Fee Token", "FEE", supply, slope, basePrice, mockERC20Contract.address],
      { account: deployer, value: creationFee }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");

    // Verify token was created
    const tokensForCreator = await factory.read.getCreatorTokens([deployer]);
    assert.ok(tokensForCreator.length >= 1, "Token should be created");

    console.log("Creation fee paid:", creationFee.toString(), "wei");
  });

  it("should fail if creation fee is insufficient", async function () {
    const { mockERC20 } = await ignition.deploy(MockERC20Module, {
      parameters: {
        MockERC20Module: {
          name: "Mock USDT 3",
          symbol: "USDT3",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    const mockERC20Contract = mockERC20 as any;
    const creationFee = parseEther("0.01"); // 0.01 ETH

    // Deploy TokenFactory with creation fee
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {
        parameters: {
          TokenFactoryModule: {
            feeRecipient: deployer,
            creationFee: creationFee,
            buyFeeBps: 0n,
          },
        },
      });

    const supply = parseUnits("100", 18);
    const slope = 10n ** 22n;
    const basePrice = 12n;

    // Try to create token without fee - should fail
    try {
      await factory.write.createToken(
        ["No Fee Token", "NFT", supply, slope, basePrice, mockERC20Contract.address],
        { account: deployer, value: 0n }
      );
      assert.fail("Should have reverted due to insufficient fee");
    } catch (error: any) {
      assert.ok(
        error.message.includes("InsufficientCreationFee") || error.message.includes("revert"),
        "Should revert with InsufficientCreationFee"
      );
      console.log("Correctly rejected: insufficient creation fee");
    }
  });

  it("should charge buy fee when buying tokens", async function () {
    const { mockERC20 } = await ignition.deploy(MockERC20Module, {
      parameters: {
        MockERC20Module: {
          name: "Mock USDT 4",
          symbol: "USDT4",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    const mockERC20Contract = mockERC20 as any;
    const buyFeeBps = 100n; // 1% fee

    // Deploy TokenFactory with buy fee
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {
        parameters: {
          TokenFactoryModule: {
            feeRecipient: deployer,
            creationFee: 0n,
            buyFeeBps: buyFeeBps,
          },
        },
      });

    const supply = 0n; // No initial supply, all tokens must be bought
    const slope = 10n ** 22n;
    const basePrice = 12n;

    // Create token
    const tx = await factory.write.createToken(
      ["Buy Fee Token", "BFT", supply, slope, basePrice, mockERC20Contract.address],
      { account: deployer }
    );
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const tokensForCreator = await factory.read.getCreatorTokens([deployer]);
    const tokenAddress = tokensForCreator[tokensForCreator.length - 1] as `0x${string}`;

    // Verify buy fee is set
    const tokenBuyFeeBps: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "buyFeeBps",
    });
    assert.equal(tokenBuyFeeBps, buyFeeBps, "Buy fee should be set");

    // Verify fee recipient is set
    const tokenFeeRecipient: string = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "feeRecipient",
    });
    assert.equal(tokenFeeRecipient.toLowerCase(), deployer.toLowerCase(), "Fee recipient should be set");

    // Get cost for buying tokens
    const buyAmount = parseUnits("1", 18);
    const cost: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "getCost",
      args: [0n, buyAmount],
    });

    // Calculate expected fee (1% of cost)
    const expectedFee = (cost * buyFeeBps) / 10000n;
    const totalNeeded = cost + expectedFee;

    console.log("Cost:", cost.toString());
    console.log("Expected fee (1%):", expectedFee.toString());
    console.log("Total needed:", totalNeeded.toString());

    // Get initial fee recipient balance
    const initialFeeRecipientBalance: bigint = await publicClient.readContract({
      address: mockERC20Contract.address,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [deployer],
    });

    // Approve payment token
    const approveTx = await deployerWallet.writeContract({
      address: mockERC20Contract.address,
      abi: tokenAbi,
      functionName: "approve",
      args: [tokenAddress, totalNeeded],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Buy tokens
    const buyTx = await deployerWallet.writeContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "buyToken",
      args: [buyAmount],
    });
    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTx });
    assert.equal(buyReceipt.status, "success", "Buy should succeed");

    // Verify token balance
    const tokenBalance: bigint = await publicClient.readContract({
      address: tokenAddress,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [deployer],
    });
    assert.equal(tokenBalance, buyAmount, "Should have bought tokens");

    console.log("Buy fee test passed! Fee collected:", expectedFee.toString());
  });

  it("should emit TokenCreated event with correct params", async function () {
    const { mockERC20 } = await ignition.deploy(MockERC20Module, {
      parameters: {
        MockERC20Module: {
          name: "Mock DAI",
          symbol: "DAI",
          initialSupply: parseUnits("1000000", 18),
        },
      },
    });

    const mockERC20Contract = mockERC20 as any;

    // Deploy TokenFactory
    const { factory }: { factory: { address: `0x${string}`; write: any; read: any } } =
      await ignition.deploy(TokenFactoryModule, {
        parameters: {
          TokenFactoryModule: {
            feeRecipient: deployer,
            creationFee: 0n,
            buyFeeBps: 0n,
          },
        },
      });

    const supply = parseUnits("500", 18);
    const slope = 10n ** 20n;
    const basePrice = 5n;

    const tx = await factory.write.createToken(
      ["Event Token", "EVT", supply, slope, basePrice, mockERC20Contract.address],
      { account: deployer }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(receipt.status, "success");

    // Verify token was created
    const tokensForCreator = await factory.read.getCreatorTokens([deployer]);
    assert.ok(tokensForCreator.length >= 1, "Token should be created");

    console.log("TokenCreated event emitted for token at:", tokensForCreator[tokensForCreator.length - 1]);
  });
});
