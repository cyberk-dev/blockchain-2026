import type { HookContext, NetworkHooks } from "hardhat/types/hooks";
import type { ChainType, NetworkConnection } from "hardhat/types/network";
import type { PublicClient } from "viem";
import { decodeEventLog } from "viem";
const MAX_UINT256 = (1n << 256n) - 1n;

function toBigInt(x: bigint | number | string): bigint {
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(x);
  if (typeof x === "string") return x.startsWith("0x") ? BigInt(x) : BigInt(x);
  throw new TypeError("Unsupported type for BigInt conversion");
}

/**
 * floor(a * b / denominator) with full precision using BigInt
 * Throws Error on denominator == 0 or if result > uint256 max
 */
export const mulDiv = (
  a: bigint | number | string,
  b: bigint | number | string,
  denominator: bigint | number | string
) => {
  const A = toBigInt(a);
  const B = toBigInt(b);
  const D = toBigInt(denominator);
  if (D === 0n) throw new Error("denominator == 0");
  const prod = A * B;
  const result = prod / D;
  if (result > MAX_UINT256) throw new Error("mulDiv overflow");
  return result;
};

/**
 * ceil(a * b / denominator)
 * Throws Error on denominator == 0 or if result > uint256 max
 */
export const mulDivRoundingUp = (
  a: bigint | number | string,
  b: bigint | number | string,
  denominator: bigint | number | string
) => {
  const A = toBigInt(a);
  const B = toBigInt(b);
  const D = toBigInt(denominator);
  if (D === 0n) throw new Error("denominator == 0");
  const prod = A * B;
  const result = prod / D;
  if (result > MAX_UINT256) throw new Error("mulDiv overflow");
  if (prod % D !== 0n) {
    const r = result + 1n;
    if (r > MAX_UINT256) throw new Error("mulDiv rounding up overflow");
    return r;
  }
  return result;
};

/**
 * @param contract - deployed contract object (with `address` and `abi`) or just address string
 * @param eventName - event name to fetch
 * @param publicClient - `viem` publicClient instance
 * @param txHash - transaction hash to filter events from a specific transaction
 * @param variableArgs - the variable name of the event args to return
 * @returns array of `args` from found events (each element is an object or array depending on ABI decoding)
 */
export async function getEventArgs(
  contract: any,
  eventName: string,
  publicClient: PublicClient,
  txHash: `0x${string}`,
  variableArgs: string
): Promise<any> {
  const address = (contract && contract.address) || contract;
  const abi = (contract && contract.abi) || undefined;

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const logs = (receipt.logs || []).filter(
    (l: any) =>
      String(l.address).toLowerCase() === String(address).toLowerCase()
  );

  const results: any[] = [];
  for (const log of logs) {
    try {
      const decoded: any = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded && decoded.eventName === eventName) {
        results.push(decoded.args);
      }
    } catch (err) {
      // ignore logs that don't decode to the expected event
    }
  }

  return results.map((r) => r[variableArgs])?.[0] ?? "";
}
