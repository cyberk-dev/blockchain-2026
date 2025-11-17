import { expect } from "chai";
import { ethers } from "hardhat";

describe("SimpleToken", function () {
  async function deploySimpleTokenFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    
    const simpleToken = await SimpleToken.deploy("My Simple Token", "MST");
    return { simpleToken, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { simpleToken, owner } = await deploySimpleTokenFixture();
      expect(await simpleToken.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
        const { simpleToken, owner } = await deploySimpleTokenFixture();
        const ownerBalance = await simpleToken.balanceOf(owner.address);
        expect(await simpleToken.totalSupply()).to.equal(ownerBalance);
        expect(await simpleToken.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens to an account", async function () {
      const { simpleToken, owner, otherAccount } = await deploySimpleTokenFixture();
      const amountToMint = ethers.parseUnits("1000", 18);
      await simpleToken.connect(owner).mint(otherAccount.address, amountToMint);
      
      const otherAccountBalance = await simpleToken.balanceOf(otherAccount.address);
      expect(otherAccountBalance).to.equal(amountToMint);

      expect(await simpleToken.totalSupply()).to.equal(amountToMint);
    });

    it("Should fail if another account tries to mint", async function () {
      const { simpleToken, otherAccount } = await deploySimpleTokenFixture();
      const amountToMint = ethers.parseUnits("1000", 18);

      await expect(
        simpleToken.connect(otherAccount).mint(otherAccount.address, amountToMint)
      ).to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount")
       .withArgs(otherAccount.address);
    });
  });
});
