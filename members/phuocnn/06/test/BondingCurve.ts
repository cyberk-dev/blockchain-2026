import { expect } from "chai";
import { network } from "hardhat";
import { parseEther, getAddress, decodeEventLog } from "viem";
import { describe, it } from "node:test";

describe("BondingCurve & Factory System", function () {
  async function deployFixture() {
    const { viem } = await network.connect();
    const [owner, buyer, feeCollector] = await viem.getWalletClients();

    const creationFee = parseEther("0.1"); 
    const factory = await viem.deployContract("TokenFactory", [
      creationFee,
      feeCollector.account.address,
    ]);

    const publicClient = await viem.getPublicClient();

    return {
      factory,
      owner,
      buyer,
      feeCollector,
      creationFee,
      publicClient,
      viem,
    };
  }

  it("Should create a token and collect creation fee", async function () {
    const { factory, owner, feeCollector, creationFee, publicClient, viem } = await deployFixture();

    const balanceBefore = await publicClient.getBalance({ address: feeCollector.account.address });

    const name = "Test Token";
    const symbol = "TST";
    const a = 1n; 
    const b = 0n; 
    const buyFeePercent = 5n; 

    const hash = await factory.write.createToken(
      [name, symbol, a, b, buyFeePercent],
      { value: creationFee }
    );
    
    await publicClient.waitForTransactionReceipt({ hash });

    const balanceAfter = await publicClient.getBalance({ address: feeCollector.account.address });
    expect(balanceAfter).to.equal(balanceBefore + creationFee);
  });

  it("Should buy tokens, deduct fee, and emit TokensPurchased event", async function () {
    const { factory, buyer, feeCollector, creationFee, publicClient, viem } = await deployFixture();

    const txHash = await factory.write.createToken(
      ["MyToken", "MTK", 1000n, 1000n, 10n], 
      { value: creationFee }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const createEventLogs = receipt.logs.map(log => {
      try {
        return decodeEventLog({
          abi: factory.abi,
          data: log.data,
          topics: log.topics,
        });
      } catch (e) {
        return null;
      }
    }).filter(evt => evt && evt.eventName === "TokenCreated");

    const newTokenAddress = (createEventLogs[0] as any).args.tokenAddress;
    
    const token = await viem.getContractAt("BondingCurveToken", newTokenAddress);

    const amountToBuy = 5n; 
    const ethToSend = parseEther("0.0001"); 

    const buyTxHash = await token.write.buy([amountToBuy], {
      value: ethToSend,
      account: buyer.account 
    });

    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTxHash });

    let eventFound = false;

    for (const log of buyReceipt.logs) {
      try {
        const decodedLog = decodeEventLog({
          abi: token.abi,
          data: log.data,
          topics: log.topics,
        });

        if (decodedLog.eventName === "TokensPurchased") {
            eventFound = true;
            const args: any = decodedLog.args;

            console.log("\n--- Event Parsed Data ---");
            console.log("Buyer:", args.buyer);
            console.log("Amount:", args.amountOfTokens.toString());
            console.log("Total Cost (incl Fee):", args.totalCost.toString());
            console.log("Fee Amount:", args.feeAmount.toString());
            console.log("-------------------------\n");

            expect(getAddress(args.buyer)).to.equal(getAddress(buyer.account.address));
            expect(args.amountOfTokens).to.equal(amountToBuy);
            expect(args.feeAmount).to.equal(1750n);
            expect(args.totalCost).to.equal(19250n);
        }
      } catch (err) {
      }
    }

    expect(eventFound).to.be.true;
  });
});