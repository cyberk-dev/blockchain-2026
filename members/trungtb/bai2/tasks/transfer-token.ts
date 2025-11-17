import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';

import SimpleTokenModule from '../ignition/modules/SimpleToken.js';
import parameters from '../token-parameter.json';
import { ArgumentType } from 'hardhat/types/arguments';

export const transferToken = task('transfer-token', 'Transfer tokens')
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
        // ...

        // Convert amount to BigInt
        const amount = BigInt(taskArgs.amount);

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(SimpleTokenModule, {
          parameters,
        });

        console.log(`Transferring ${taskArgs.amount} tokens to ${taskArgs.to}`);
        const tx = await token.write.transfer([
          taskArgs.to as `0x${string}`,
          amount,
        ]);
        console.log('transfer tx=', tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('transfer success');
      },
    });
  })
  .build();
