import { task } from 'hardhat/config';
import { ArgumentType } from 'hardhat/types/arguments';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import { decodeEventLog, getAddress, parseUnits } from 'viem';

export const buyTokens = task(
  'buy-tokens',
  'Buy tokens from a deployed token contract'
)
  .addOption({
    name: 'token',
    description: 'The address of the token contract',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'amount',
    description:
      'The amount of tokens to buy (in token units, e.g., "1" for 1 token)',
    type: ArgumentType.STRING,
    defaultValue: '',
  })
  .addOption({
    name: 'slope',
    description: 'The slope parameter for bonding curve',
    type: ArgumentType.STRING,
    defaultValue: '1',
  })
  .addOption({
    name: 'intercept',
    description: 'The intercept parameter for bonding curve',
    type: ArgumentType.STRING,
    defaultValue: '1',
  })
  .setAction(() => {
    return Promise.resolve({
      default: async (
        taskArgs: {
          token: string;
          amount: string;
          slope: string;
          intercept: string;
        },
        hre: HardhatRuntimeEnvironment
      ) => {
        const connection = await hre.network.connect();
        const { viem } = connection;
        const publicClient = await viem.getPublicClient();
        const [buyer] = await viem.getWalletClients();

        const tokenAddr = getAddress(taskArgs.token) as `0x${string}`;
        console.log(`Using Token at: ${tokenAddr}`);

        const token = await viem.getContractAt('Token', tokenAddr);

        const amount = parseUnits(taskArgs.amount, 18);
        const slope = BigInt(taskArgs.slope);
        const intercept = BigInt(taskArgs.intercept);

        const currentSupply = await token.read.totalSupply();

        const totalCost = await token.read.getCost([
          currentSupply,
          amount,
          slope,
          intercept,
        ]);
        const feePercentage = await (token.read as any).feePercentage();
        const fee = (totalCost * feePercentage) / 10000n;
        const totalPayment = totalCost + fee;

        console.log(`Current supply: ${currentSupply}`);
        console.log(`Amount to buy: ${amount}`);
        console.log(`Total cost: ${totalCost} wei`);
        console.log(`Fee (${feePercentage / 100n}%): ${fee} wei`);
        console.log(`Total payment: ${totalPayment} wei`);

        const balanceBefore = await token.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`Buyer balance before: ${balanceBefore}`);

        const tx = await token.write.buyToken([amount, slope, intercept], {
          account: buyer.account,
          value: totalPayment,
        });

        console.log(`Transaction hash: ${tx}`);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        let decoded: any = null;
        for (const log of receipt.logs) {
          if (getAddress(log.address) === getAddress(tokenAddr)) {
            try {
              const event = decodeEventLog({
                abi: token.abi,
                data: log.data,
                topics: log.topics,
              });
              if (event.eventName === 'TokenBought') {
                decoded = event;
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }

        if (!decoded) {
          throw new Error('TokenBought event not found in logs');
        }

        const args = decoded.args as any;
        console.log(`\n✅ Tokens bought successfully!`);
        console.log(`Buyer: ${args.buyer}`);
        console.log(`Amount: ${args.amount}`);
        console.log(`Cost: ${args.cost} wei`);
        console.log(`Fee: ${args.fee} wei`);

        const balanceAfter = await token.read.balanceOf([
          buyer.account.address,
        ]);
        console.log(`Buyer balance after: ${balanceAfter}`);
        console.log(`Tokens received: ${balanceAfter - balanceBefore}`);
      },
    });
  })
  .build();
