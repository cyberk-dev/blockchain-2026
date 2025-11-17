import { task } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import TokenModule from '../ignition/modules/Token.js';
import parameters from '../token-parameter.json';

export const transferTokenTask = task('transfer-token', 'Transfer token')
  .addOption({
    name: 'to',
    description: 'Address to receive tokens',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'amount',
    description: 'Amount (as bigint)',
    type: ArgumentType.BIGINT,
    defaultValue: 0n,
  })
  .setAction(async () => {
    return {
      default: async (args: { to: string; amount: bigint }, hre: HardhatRuntimeEnvironment) => {
        const { to, amount } = args;

        if (!to || amount === 0n) {
          throw new Error('Missing required arguments: to and amount');
        }

        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();

        const { token } = await ignition.deploy(TokenModule, {
          parameters,
        });

        const tx = await token.write.transfer([to as `0x${string}`, amount]);
        console.log("transfer tx=", tx);

        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
