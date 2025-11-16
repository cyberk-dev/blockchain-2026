import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { ArgumentType } from 'hardhat/types/arguments';
import parameters from '../ignition/parameters.json';
import Token from '../ignition/modules/Token.js';

export const transferTokenTask = task('transfer-token', 'Transfer token')
  .addOption({
    name: 'to',
    description: 'The address to transfer the tokens to',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'amount',
    description: 'The amount of tokens to transfer',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (
        taskArgs: { to: string; amount: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        // Validate parameters
        if (!taskArgs.to || !taskArgs.amount) {
          throw new Error('Both --to and --amount parameters are required');
        }

        // Convert amount to BigInt
        const amount = BigInt(taskArgs.amount);

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        // Convert initialSupply from string to bigint
        const processedParameters = {
          TokenModule: {
            ...parameters.TokenModule,
            initialSupply: typeof parameters.TokenModule.initialSupply === 'string'
              ? BigInt(parameters.TokenModule.initialSupply.replace('n', ''))
              : parameters.TokenModule.initialSupply
          }
        };

        const { token } = await ignition.deploy(Token, {
          parameters: processedParameters
        });

        console.log(`Transferring ${taskArgs.amount} tokens to ${taskArgs.to}`);
        const tx = await token.write.transfer([
          taskArgs.to as `0x${string}`,
          amount,
        ]);
        console.log("transfer tx=", tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success", receipt);
      },
    });
  })
  .build();
