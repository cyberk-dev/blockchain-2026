import { task } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { decodeEventLog } from 'viem';
import TokenFactoryModule from '../ignition/modules/TokenFactory.js';

export const createToken = task('create-token', 'Create a token')
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
    name: 'initialSupply',
    description: 'The initial supply of the token',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (
        taskArgs: { name: string; symbol: string; initialSupply: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const { tokenFactory } = await ignition.deploy(TokenFactoryModule);

        const tx = await tokenFactory.write.createToken([
          taskArgs.name,
          taskArgs.symbol,
          BigInt(taskArgs.initialSupply),
        ]);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });
        const log = receipt.logs.find(
          (log) =>
            log.address.toLowerCase() === tokenFactory.address.toLowerCase()
        );
        if (!log) {
          throw new Error('TokenCreated event not found');
        }
        const decoded = decodeEventLog({
          abi: tokenFactory.abi,
          data: log.data,
          topics: log.topics,
        });
        const tokenAddress = decoded?.args?.tokenAddress as `0x${string}`;
        console.log(`Token created: ${tokenAddress}`);
      },
    });
  })
  .build();
