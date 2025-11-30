import { task } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import TokenFactoryModule from '../ignition/modules/TokenFactory.js';
import { decodeEventLog, getAddress } from 'viem';

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
    name: 'factory',
    description: 'The address of the token factory',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (taskArgs, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [creator] = await viem.getWalletClients();

        const factoryAddr = getAddress(taskArgs.factory) as `0x${string}`;
        console.log(`Using TokenFactory at: ${factoryAddr}`);
        const tokenFactory = await viem.getContractAt(
          'TokenFactory',
          factoryAddr
        );
        const creationFee = await tokenFactory.read.creationFee();

        const tx = await tokenFactory.write.createToken(
          [taskArgs.name, taskArgs.symbol],
          {
            account: creator.account,
            value: creationFee,
          }
        );
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
        const tokenAddress = (decoded?.args as any)
          ?.tokenAddress as `0x${string}`;
        console.log(`Token created: ${tokenAddress}`);
      },
    });
  })
  .build();
