import { ContractReturnType } from "@nomicfoundation/hardhat-viem/types";
import { NetworkConnection } from "hardhat/types/network";
import {
  decodeEventLog,
  GetContractReturnType,
  TransactionReceipt,
} from "viem";
import _ from "lodash";

export const extractEvent = async <T extends string>(
  connection: NetworkConnection,
  contract: ContractReturnType<T> | GetContractReturnType,
  receipt: TransactionReceipt | string,
  eventName: string
) => {
  return _.first(await extractEvents(connection, contract, receipt, eventName));
};

export const extractEvents = async <T extends string>(
  connection: NetworkConnection,
  contract: ContractReturnType<T> | GetContractReturnType,
  receipt: TransactionReceipt | string,
  eventName: string
) => {
  const publicClient = await connection.viem.getPublicClient();
  if (typeof receipt === "string") {
    receipt = await publicClient.waitForTransactionReceipt({
      hash: receipt as `0x${string}`,
    });
  }
  return receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({
          abi: contract.abi,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        return null;
      }
    })
    .filter((log) => {
      return log?.eventName === eventName;
    }) as any as { args: any; eventName: string }[];
};
