import { expect } from "chai";
import { ethers } from "hardhat";

describe("SimpleToken", function () {
  async function deploySimpleTokenFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    
    const simpleToken = await ethers.deployContract("SimpleToken", ["Simple Test Token", "STT"]);
    await simpleToken.waitForDeployment();
    return { simpleToken, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { simpleToken, owner } = await deploySimpleTokenFixture();
      expect(await simpleToken.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      const { simpleToken } = await deploySimpleTokenFixture();
      expect(await simpleToken.name()).to.equal("Simple Test Token");
      expect(await simpleToken.symbol()).to.equal("STT");
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to an account", async function () {
      const { simpleToken, owner, otherAccount } = await deploySimpleTokenFixture();
      const amountToMint = ethers.parseUnits("1000", 18);
      const address = await simpleToken.getAddress();
      
      const ownerContract = await ethers.getContractAt("SimpleToken", address, owner);
      await ownerContract.mint(otherAccount.address, amountToMint);
      
      const otherAccountBalance = await simpleToken.balanceOf(otherAccount.address);
      expect(otherAccountBalance).to.equal(amountToMint);

      expect(await simpleToken.totalSupply()).to.equal(amountToMint);
    });

    it("Should fail if another account tries to mint", async function () {
      const { simpleToken, otherAccount } = await deploySimpleTokenFixture();
      const amountToMint = ethers.parseUnits("1000", 18);
      const address = await simpleToken.getAddress();

      const otherAccountContract = await ethers.getContractAt("SimpleToken", address, otherAccount);
      await expect(
        otherAccountContract.mint(otherAccount.address, amountToMint)
      ).to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount")
       .withArgs(otherAccount.address);
    });
  });
});

