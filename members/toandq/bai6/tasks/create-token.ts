import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { ArgumentType } from 'hardhat/types/arguments';
import TokenFactory from '../ignition/modules/TokenFactory.js';
import { decodeEventLog } from 'viem';

export const createTokenTask = task('create-token', 'Create a new token using TokenFactory')
  .addOption({
    name: 'name',
    description: 'The name of the token',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'symbol',
    description: 'The symbol of the token',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'fee',
    description: 'The fee to pay (in wei, optional - will read from contract if not provided)',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (
        taskArgs: { name: string; symbol: string; fee: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        // Validate parameters
        if (!taskArgs.name || !taskArgs.symbol) {
          throw new Error('Both --name and --symbol parameters are required');
        }

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();

        // Deploy or get TokenFactory
        const { factory } = await ignition.deploy(TokenFactory);

        // Get fee from contract if not provided, otherwise use provided fee
        let fee: bigint;
        if (taskArgs.fee) {
          fee = BigInt(taskArgs.fee);
        } else {
          fee = await factory.read.fee();
          console.log(`Using fee from contract: ${fee} wei`);
        }

        console.log(`Creating token: ${taskArgs.name} (${taskArgs.symbol})`);
        console.log(`Paying fee: ${fee} wei`);

        // Call createToken with name, symbol, and fee
        const tx = await factory.write.createToken([
          taskArgs.name,
          taskArgs.symbol,
        ], {
          value: fee,
          account: deployer.account,
        });

        console.log("createToken tx=", tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("createToken success", receipt);

        // Parse the event to get the token address
        const logs = receipt.logs;
        const eventAbi = [
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: "tokenAddress", type: "address" },
              { indexed: true, name: "owner", type: "address" },
              { indexed: false, name: "name", type: "string" },
              { indexed: false, name: "symbol", type: "string" },
            ],
            name: "TokensPurchased",
            type: "event",
          },
        ];

        for (const log of logs) {
          try {
            // decodeEventLog does not exist on publicClient, so use viem's decodeEventLog function
            // Import decodeEventLog from viem at the top of the file:
            // import { decodeEventLog } from 'viem';
            const decoded = decodeEventLog({
              abi: eventAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'TokensPurchased') {
              console.log(decoded)
            }
          } catch (e) {
            // Not the event we're looking for
          }
        }
      },
    });
  })
  .build();
