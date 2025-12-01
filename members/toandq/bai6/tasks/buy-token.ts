import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { ArgumentType } from 'hardhat/types/arguments';
import { getAddress, decodeEventLog } from 'viem';

// Price per token: 0.000000000001 ether = 1,000,000 wei
const PRICE_PER_TOKEN = BigInt('1000000'); // 0.000000000001 ether in wei

export const buyTokenTask = task('buy-token', 'Buy tokens by sending ETH')
  .addOption({
    name: 'token',
    description: 'The token contract address',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'amount',
    description: 'The amount of tokens to buy',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (
        taskArgs: { token: string; amount: string },
        hre: HardhatRuntimeEnvironment
      ) => {
        // Validate parameters
        if (!taskArgs.token || !taskArgs.amount) {
          throw new Error('Both --token and --amount parameters are required');
        }

        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [buyer] = await viem.getWalletClients();

        console.log('Interacting with account:', buyer.account.address);

        const tokenAddr = getAddress(taskArgs.token) as `0x${string}`;
        console.log(`Token address: ${tokenAddr}`);

        const tokenContract = await viem.getContractAt('Token', tokenAddr);

        // Parse amount
        const tokenAmount = BigInt(taskArgs.amount);

        // Calculate cost: amount * 0.000000000001 ether
        const cost = tokenAmount * PRICE_PER_TOKEN;

        console.log(`\nBuying token information:`);
        console.log(`- Token amount: ${tokenAmount}`);
        console.log(`- Cost: ${cost} wei (${tokenAmount} * 0.000000000001 ether)`);

        // Check ETH balance
        const ethBalance = await publicClient.getBalance({
          address: buyer.account.address,
        });
        console.log(`\nETH balance: ${ethBalance} wei`);

        if (ethBalance < cost) {
          throw new Error(
            `Not enough ETH! Need ${cost} wei but only have ${ethBalance} wei`
          );
        }

        // Check token balance before buying
        const balanceBefore = await tokenContract.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`Token balance before buying: ${balanceBefore}`);

        // Buy tokens
        console.log(`\nBuying tokens...`);
        const buyTx = await tokenContract.write.buyToken([tokenAmount], {
          account: buyer.account,
          value: cost,
        });

        console.log('Transaction hash:', buyTx);
        console.log('Waiting for confirmation...');

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: buyTx,
        });
        console.log('✅ Tokens bought successfully!');

        // Check token balance after buying
        const balanceAfter = await tokenContract.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`\nToken balance after buying: ${balanceAfter}`);
        console.log(`Tokens received: ${balanceAfter - balanceBefore}`);

        // Parse the TokenBought event
        const eventAbi = [
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: 'buyer', type: 'address' },
              { indexed: false, name: 'amount', type: 'uint256' },
              { indexed: false, name: 'cost', type: 'uint256' },
            ],
            name: 'TokenBought',
            type: 'event',
          },
        ];

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: eventAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === 'TokenBought') {
              console.log(decoded)
            }
          } catch (e) {
            // Not the event we're looking for
          }
        }

        return {
          txHash: buyTx,
          tokenAmount,
          cost,
          balanceBefore,
          balanceAfter,
        };
      },
    });
  })
  .build();
