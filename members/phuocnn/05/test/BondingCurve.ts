import hre from "hardhat";
import { expect } from "chai";
import { parseEther, formatEther, parseUnits } from "viem";

describe("BondingCurve & TokenFactory", function () {
  async function deployFixture() {
    const [owner, buyer1, buyer2, feeRecipient] = await hre.viem.getWalletClients();

    // Deploy MockUSDT
    const mockUSDT = await hre.viem.deployContract("MockUSDT", []);
    
    // Mint USDT cho buyers
    await mockUSDT.write.mint([buyer1.account.address, parseUnits("10000", 18)]);
    await mockUSDT.write.mint([buyer2.account.address, parseUnits("10000", 18)]);

    // Deploy TokenFactory
    const factory = await hre.viem.deployContract("TokenFactory", [feeRecipient.account.address]);

    return {
      mockUSDT,
      factory,
      owner,
      buyer1,
      buyer2,
      feeRecipient,
      publicClient: await hre.viem.getPublicClient(),
    };
  }

  describe("TokenFactory", function () {
    it("Should deploy factory successfully with correct fee recipient", async function () {
      const { factory, feeRecipient } = await deployFixture();
      
      const recipient = await factory.read.feeRecipient();
      expect(recipient.toLowerCase()).to.equal(feeRecipient.account.address.toLowerCase());
    });

    it("Should create new token with creation fee", async function () {
      const { factory, mockUSDT, buyer1, feeRecipient, publicClient } = await deployFixture();
      
      const creationFee = parseEther("0.01");
      const feeRecipientBalanceBefore = await publicClient.getBalance({
        address: feeRecipient.account.address,
      });
      
      const hash = await factory.write.createToken(
        ["Test Token", "TEST", mockUSDT.address],
        { 
          value: creationFee,
          account: buyer1.account,
        }
      );
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      const feeRecipientBalanceAfter = await publicClient.getBalance({
        address: feeRecipient.account.address,
      });
      
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(creationFee);
      
      const logs = await publicClient.getLogs({
        address: factory.address,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      
      expect(logs.length).to.be.greaterThan(0);
      
      const count = await factory.read.getDeployedTokensCount();
      expect(count).to.equal(1n);
    });

    it("Should revert if creation fee is not enough", async function () {
      const { factory, mockUSDT, buyer1 } = await deployFixture();
      
      await expect(
        factory.write.createToken(
          ["Test Token", "TEST", mockUSDT.address],
          { 
            value: parseEther("0.001"),
            account: buyer1.account,
          }
        )
      ).to.be.rejectedWith("Insufficient creation fee");
    });

    it("Should store deployed tokens list", async function () {
      const { factory, mockUSDT, buyer1 } = await deployFixture();
      
      await factory.write.createToken(
        ["Token 1", "TK1", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      await factory.write.createToken(
        ["Token 2", "TK2", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      await factory.write.createToken(
        ["Token 3", "TK3", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      const tokens = await factory.read.getDeployedTokens();
      expect(tokens.length).to.equal(3);
      
      const count = await factory.read.getDeployedTokensCount();
      expect(count).to.equal(3n);
    });
  });

  describe("BondingCurve - Linear Formula", function () {
    async function deployBondingCurveFixture() {
      const base = await deployFixture();
      const { factory, mockUSDT, buyer1, buyer2, feeRecipient } = base;
      
      const hash = await factory.write.createToken(
        ["Bonding Token", "BOND", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      const receipt = await base.publicClient.waitForTransactionReceipt({ hash });
      const tokens = await factory.read.getDeployedTokens();
      const bondingCurveAddress = tokens[0];
      
      const bondingCurve = await hre.viem.getContractAt(
        "BondingCurve",
        bondingCurveAddress
      );
      
      return {
        ...base,
        bondingCurve,
      };
    }

    it("Should have correct parameters for linear curve", async function () {
      const { bondingCurve } = await deployBondingCurveFixture();
      
      const slope = await bondingCurve.read.SLOPE();
      const initialPrice = await bondingCurve.read.INITIAL_PRICE();
      const feeBasisPoints = await bondingCurve.read.FEE_BASIS_POINTS();
      
      expect(slope).to.equal(parseUnits("1", 22));
      expect(initialPrice).to.equal(parseUnits("10", 22));
      expect(feeBasisPoints).to.equal(200n);
    });

    it("Should calculate correct cost for first buy (supply = 0)", async function () {
      const { bondingCurve } = await deployBondingCurveFixture();
      
      const amount = parseUnits("100", 18);
      const cost = await bondingCurve.read.calculateBuyCost([amount]);
      
      const expectedCost = parseUnits("6000", 18);
      expect(cost).to.equal(expectedCost);
    });

    it("Should calculate increasing cost with supply (linear)", async function () {
      const { bondingCurve, mockUSDT, buyer1 } = await deployBondingCurveFixture();
      
      await mockUSDT.write.approve(
        [bondingCurve.address, parseUnits("100000", 18)],
        { account: buyer1.account }
      );
      
      const cost1 = await bondingCurve.read.calculateBuyCost([parseUnits("100", 18)]);
      await bondingCurve.write.buyTokens([parseUnits("100", 18)], { account: buyer1.account });
      
      const cost2 = await bondingCurve.read.calculateBuyCost([parseUnits("100", 18)]);
      
      expect(cost2).to.be.greaterThan(cost1);
    });

    it("Should calculate current price correctly", async function () {
      const { bondingCurve, mockUSDT, buyer1 } = await deployBondingCurveFixture();
      
      const initialPrice = await bondingCurve.read.getCurrentPrice();
      expect(initialPrice).to.equal(10n);
      
      await mockUSDT.write.approve(
        [bondingCurve.address, parseUnits("100000", 18)],
        { account: buyer1.account }
      );
      await bondingCurve.write.buyTokens([parseUnits("100", 18)], { account: buyer1.account });
      
      const newPrice = await bondingCurve.read.getCurrentPrice();
      expect(newPrice).to.equal(110n);
    });
  });

  describe("BondingCurve - Buy Tokens with Fees", function () {
    async function deployBondingCurveFixture() {
      const base = await deployFixture();
      const { factory, mockUSDT, buyer1 } = base;
      
      const hash = await factory.write.createToken(
        ["Bonding Token", "BOND", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      await base.publicClient.waitForTransactionReceipt({ hash });
      const tokens = await factory.read.getDeployedTokens();
      
      const bondingCurve = await hre.viem.getContractAt(
        "BondingCurve",
        tokens[0]
      );
      
      return { ...base, bondingCurve };
    }

    it("Should deduct fee when buying tokens", async function () {
      const { bondingCurve, mockUSDT, buyer1, feeRecipient } = await deployBondingCurveFixture();
      
      const amount = parseUnits("100", 18);
      const baseCost = await bondingCurve.read.calculateBuyCost([amount]);
      const expectedFee = (baseCost * 200n) / 10000n;
      const totalCost = baseCost + expectedFee;
      
      await mockUSDT.write.approve(
        [bondingCurve.address, totalCost],
        { account: buyer1.account }
      );
      
      const feeRecipientBalanceBefore = await mockUSDT.read.balanceOf([feeRecipient.account.address]);
      
      await bondingCurve.write.buyTokens([amount], { account: buyer1.account });
      
      const feeRecipientBalanceAfter = await mockUSDT.read.balanceOf([feeRecipient.account.address]);
      
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(expectedFee);
      
      const buyerBalance = await bondingCurve.read.balanceOf([buyer1.account.address]);
      expect(buyerBalance).to.equal(amount);
    });

    it("Should emit event TokensPurchased with correct parameters", async function () {
      const { bondingCurve, mockUSDT, buyer1, publicClient } = await deployBondingCurveFixture();
      
      const amount = parseUnits("100", 18);
      const baseCost = await bondingCurve.read.calculateBuyCost([amount]);
      const fee = (baseCost * 200n) / 10000n;
      const totalCost = baseCost + fee;
      
      await mockUSDT.write.approve(
        [bondingCurve.address, totalCost],
        { account: buyer1.account }
      );
      
      const hash = await bondingCurve.write.buyTokens([amount], { account: buyer1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      const logs = await publicClient.getLogs({
        address: bondingCurve.address,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      
      const tokensPurchasedLog = logs.find(log => {
        try {
          const decoded = hre.viem.decodeEventLog({
            abi: bondingCurve.abi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'TokensPurchased';
        } catch {
          return false;
        }
      });
      
      expect(tokensPurchasedLog).to.not.be.undefined;
      
      if (tokensPurchasedLog) {
        const decoded = hre.viem.decodeEventLog({
          abi: bondingCurve.abi,
          data: tokensPurchasedLog.data,
          topics: tokensPurchasedLog.topics,
        });
        
        expect(decoded.args.buyer.toLowerCase()).to.equal(buyer1.account.address.toLowerCase());
        expect(decoded.args.amountTokens).to.equal(amount);
        expect(decoded.args.cost).to.equal(baseCost);
        expect(decoded.args.fee).to.equal(fee);
        expect(decoded.args.newSupply).to.equal(amount);
      }
    });

    it("Should revert if not enough USDT approved", async function () {
      const { bondingCurve, mockUSDT, buyer1 } = await deployBondingCurveFixture();
      
      const amount = parseUnits("100", 18);
      
      await mockUSDT.write.approve(
        [bondingCurve.address, parseUnits("1", 18)],
        { account: buyer1.account }
      );
      
      await expect(
        bondingCurve.write.buyTokens([amount], { account: buyer1.account })
      ).to.be.rejected;
    });

    it("Should handle multiple purchases correctly", async function () {
      const { bondingCurve, mockUSDT, buyer1, buyer2 } = await deployBondingCurveFixture();
      
      const amount1 = parseUnits("100", 18);
      let cost = await bondingCurve.read.calculateBuyCost([amount1]);
      let totalCost = cost + (cost * 200n) / 10000n;
      
      await mockUSDT.write.approve([bondingCurve.address, totalCost], { account: buyer1.account });
      await bondingCurve.write.buyTokens([amount1], { account: buyer1.account });
      
      const amount2 = parseUnits("50", 18);
      cost = await bondingCurve.read.calculateBuyCost([amount2]);
      totalCost = cost + (cost * 200n) / 10000n;
      
      await mockUSDT.write.approve([bondingCurve.address, totalCost], { account: buyer2.account });
      await bondingCurve.write.buyTokens([amount2], { account: buyer2.account });
      
      const buyer1Balance = await bondingCurve.read.balanceOf([buyer1.account.address]);
      const buyer2Balance = await bondingCurve.read.balanceOf([buyer2.account.address]);
      const totalSupply = await bondingCurve.read.totalSupply();
      
      expect(buyer1Balance).to.equal(amount1);
      expect(buyer2Balance).to.equal(amount2);
      expect(totalSupply).to.equal(amount1 + amount2);
    });
  });

  describe("BondingCurve - Sell Tokens", function () {
    async function deployBondingCurveFixture() {
      const base = await deployFixture();
      const { factory, mockUSDT, buyer1 } = base;
      
      const hash = await factory.write.createToken(
        ["Bonding Token", "BOND", mockUSDT.address],
        { value: parseEther("0.01"), account: buyer1.account }
      );
      
      await base.publicClient.waitForTransactionReceipt({ hash });
      const tokens = await factory.read.getDeployedTokens();
      
      const bondingCurve = await hre.viem.getContractAt(
        "BondingCurve",
        tokens[0]
      );
      
      return { ...base, bondingCurve };
    }

    it("Should sell tokens and receive refund", async function () {
      const { bondingCurve, mockUSDT, buyer1 } = await deployBondingCurveFixture();
      
      const buyAmount = parseUnits("100", 18);
      let cost = await bondingCurve.read.calculateBuyCost([buyAmount]);
      let totalCost = cost + (cost * 200n) / 10000n;
      
      await mockUSDT.write.approve([bondingCurve.address, totalCost], { account: buyer1.account });
      await bondingCurve.write.buyTokens([buyAmount], { account: buyer1.account });
      
      const sellAmount = parseUnits("50", 18);
      const expectedRefund = await bondingCurve.read.calculateSellRefund([sellAmount]);
      
      const buyer1BalanceBefore = await mockUSDT.read.balanceOf([buyer1.account.address]);
      
      await bondingCurve.write.sellTokens([sellAmount], { account: buyer1.account });
      
      const buyer1BalanceAfter = await mockUSDT.read.balanceOf([buyer1.account.address]);
      
      expect(buyer1BalanceAfter - buyer1BalanceBefore).to.equal(expectedRefund);
      
      const tokenBalance = await bondingCurve.read.balanceOf([buyer1.account.address]);
      expect(tokenBalance).to.equal(buyAmount - sellAmount);
    });

    it("Should emit event TokensSold", async function () {
      const { bondingCurve, mockUSDT, buyer1, publicClient } = await deployBondingCurveFixture();
      
      const buyAmount = parseUnits("100", 18);
      let cost = await bondingCurve.read.calculateBuyCost([buyAmount]);
      let totalCost = cost + (cost * 200n) / 10000n;
      
      await mockUSDT.write.approve([bondingCurve.address, totalCost], { account: buyer1.account });
      await bondingCurve.write.buyTokens([buyAmount], { account: buyer1.account });
      
      const sellAmount = parseUnits("50", 18);
      const hash = await bondingCurve.write.sellTokens([sellAmount], { account: buyer1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      const logs = await publicClient.getLogs({
        address: bondingCurve.address,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });
      
      const tokensSoldLog = logs.find(log => {
        try {
          const decoded = hre.viem.decodeEventLog({
            abi: bondingCurve.abi,
            data: log.data,
            topics: log.topics,
          });
          return decoded.eventName === 'TokensSold';
        } catch {
          return false;
        }
      });
      
      expect(tokensSoldLog).to.not.be.undefined;
    });

    it("Should revert if selling more than balance", async function () {
      const { bondingCurve, mockUSDT, buyer1 } = await deployBondingCurveFixture();
      
      const buyAmount = parseUnits("100", 18);
      let cost = await bondingCurve.read.calculateBuyCost([buyAmount]);
      let totalCost = cost + (cost * 200n) / 10000n;
      
      await mockUSDT.write.approve([bondingCurve.address, totalCost], { account: buyer1.account });
      await bondingCurve.write.buyTokens([buyAmount], { account: buyer1.account });
      
      await expect(
        bondingCurve.write.sellTokens([parseUnits("200", 18)], { account: buyer1.account })
      ).to.be.rejectedWith("Insufficient balance");
    });
  });
});

