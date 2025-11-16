import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import parameters from '../ignition/parameters.json';
import Token from '../ignition/modules/Token.js';

export const transferTokenTask = task('transfer-token', 'Transfer token')
  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
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

        const tx = await token.write.transfer(["0x4E60672a8DB169e322dF5B36599c77Bce3383998", 1000n]);
        console.log("transfer tx=", tx);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success", receipt);
      },
    };
  })
  .build();
