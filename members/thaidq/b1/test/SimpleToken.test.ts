import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();
const { loadFixture } = networkHelpers;

describe("SimpleToken", function () {
  async function deploySimpleTokenFixture() {
    const [owner, addr1] = await ethers.getSigners();

    const simpleToken = await ethers.deployContract("SimpleToken", [
      "ThaiDQ",
      "TDQ",
    ]);

    return { simpleToken, owner, addr1 };
  }

  describe("Mint", function () {
    it("Should mint tokens to an address", async function () {
      const { simpleToken, addr1 } = await loadFixture(
        deploySimpleTokenFixture
      );

      // Get balance before mint
      const amountBefore = await simpleToken.balanceOf(addr1.address);
      const mintAmount = ethers.parseEther("100");
      
      // Use owner to mint by default ( not use connect )
      await expect(simpleToken.mint(addr1.address, mintAmount)).to.changeTokenBalance(ethers, simpleToken, addr1.address, mintAmount);
      
      // Check balance after mint
      expect(await simpleToken.balanceOf(addr1.address)).to.equal(amountBefore + mintAmount);
    });

    it("Should only allow owner to mint", async function () {
      const { simpleToken, owner, addr1 } = await loadFixture(
        deploySimpleTokenFixture
      );

      const mintAmount = ethers.parseEther("100");
      
      // Use addr1 to mint ( through connect )
      await expect(
        (simpleToken.connect(addr1) as any).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount");
      
      // Owner should be able to mint
      await expect(
        (simpleToken.connect(owner) as any).mint(addr1.address, mintAmount)
      ).to.changeTokenBalance(ethers, simpleToken, addr1.address, mintAmount);
    });
  });
});

