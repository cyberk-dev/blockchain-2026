import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("FullMath", async function () {
  const { viem } = await network.connect();

  it("should calculate mulDiv correctly", async function () {
    const fullMath = await viem.deployContract("FullMathMock");
    
    // Standard case
    const result = await fullMath.read.mulDiv([10n, 10n, 5n]);
    assert.equal(result, 20n);

    // Overflow case (phantom overflow)
    // 2^256 / 2 * 3 = 1.5 * 2^256 (overflows 256)
    // We need inputs that overflow intermediate multiplication but result fits in 256
    // a = 2^255, b = 2, d = 2
    // a*b = 2^256 (overflow)
    // result = 2^255
    const Q128 = 2n ** 128n;
    const a = Q128 * Q128; // 2^256 is too big for uint256 input, wait.
    // a and b are uint256.
    // Let a = 2^255, b = 2.
    const two255 = 2n ** 255n;
    const res2 = await fullMath.read.mulDiv([two255, 2n, 2n]);
    assert.equal(res2, two255);
  });

  it("should calculate mulDivRoundingUp correctly", async function () {
    const fullMath = await viem.deployContract("FullMathMock");
    
    // Exact division
    const res1 = await fullMath.read.mulDivRoundingUp([10n, 10n, 5n]);
    assert.equal(res1, 20n);

    // Rounding up
    // 10 * 10 / 3 = 33.33 -> 34
    const res2 = await fullMath.read.mulDivRoundingUp([10n, 10n, 3n]);
    assert.equal(res2, 34n);
    
    // Overflow case for rounding up
    const two255 = 2n ** 255n;
    const res3 = await fullMath.read.mulDivRoundingUp([two255, 2n, 2n]);
    assert.equal(res3, two255);
  });
});
