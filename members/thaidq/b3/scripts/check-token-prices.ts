import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";
import { parseUnits, formatEther } from "viem";

/**
 * Script to check individual token prices
 * Usage: npx hardhat run scripts/check-token-prices.ts --network <network>
 * 
 * You can modify the `tokensToBuy` variable below to see prices for different amounts
 */
async function main() {
  const { viem, ignition } = await network.connect();
  
  // Deploy or get existing token
  const { token } = await ignition.deploy(TokenModule, {
    parameters: {
      TokenModule: {
        name: "THAI",
        symbol: "TDQ",
        initialSupply: parseUnits("100000", 18),
      },
    },
  });

  console.log(`Token address: ${token.address}\n`);

  // User input: tokens already sold and tokens to buy
  // Change these values via environment variables or modify defaults
  const tokensSoldInput = process.env.TOKENS_SOLD || "0"; // Tokens already sold
  const tokensToBuyInput = process.env.TOKENS_TO_BUY || "10"; // Tokens to buy
  
  const tokensSoldCount = Number(tokensSoldInput);
  const tokensToBuyCount = Number(tokensToBuyInput);
  const startIndex = tokensSoldCount + 1; // 1-indexed

  // Get bonding curve parameters first
  const a = await (token.read as any).a();
  const b = await (token.read as any).b();

  console.log(`[1] Token Price Calculator`);
  console.log("=".repeat(70));
  console.log(`Input:`);
  console.log(`  - Tokens already sold: ${tokensSoldInput}`);
  console.log(`  - Tokens to buy: ${tokensToBuyInput}`);
  console.log(`  - Starting from token #${startIndex}`);
  console.log(`  - Will calculate prices for tokens #${startIndex} to #${startIndex + tokensToBuyCount - 1}\n`);

  console.log(`[2] Bonding Curve Parameters:`);
  console.log(`  - a (slope): ${formatEther(a)} ETH`);
  console.log(`  - b (starting price): ${formatEther(b)} ETH`);
  console.log(`  - Formula: price = ${formatEther(a)} * x + ${formatEther(b)}`);
  console.log(`  - where x is the token index (1-indexed)\n`);

  // Get prices for each token
  const prices = await (token.read as any).getTokenPrices([
    BigInt(startIndex),
    BigInt(tokensToBuyInput),
  ]);

  console.log(`[3] Individual Token Prices:`);
  let totalCost = 0n;
  for (let i = 0; i < prices.length; i++) {
    const tokenNumber = startIndex + i;
    const price = prices[i];
    totalCost += price;
    console.log(`  Token #${tokenNumber}: ${formatEther(price)} ETH`);
  }

  console.log("=".repeat(70));
  console.log(`\n[4] Total Cost for ${tokensToBuyInput} tokens:`);
  console.log(`  - Sum of individual prices: ${formatEther(totalCost)} ETH`);

  // Manual calculation for verification
  // Formula: N * (a * S + a * (N + 1) / 2 + b)
  // Note: a and b are in wei, S and N are token counts (integers)
  const S = BigInt(tokensSoldInput);
  const N = BigInt(tokensToBuyInput);
  // a * S: a (wei per token) * S (token count) = wei
  const aS = a * S;
  // a * (N + 1) / 2: a (wei per token) * (N + 1) / 2 = wei
  const aNPlus1Over2 = (a * (N + 1n)) / 2n;
  // Average price per token: aS + aNPlus1Over2 + b (all in wei)
  const avgPricePerToken = aS + aNPlus1Over2 + b;
  // Total cost: N (token count) * avgPricePerToken (wei) = wei
  const manualCost = N * avgPricePerToken;
  
  console.log(`  - Manual calculation: ${formatEther(manualCost)} ETH`);
  console.log(`    (Formula: ${tokensToBuyInput} * (${formatEther(a)} * ${tokensSoldInput} + ${formatEther(a)} * (${tokensToBuyInput} + 1) / 2 + ${formatEther(b)}))`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

