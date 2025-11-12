import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();
const { loadFixture, time } = networkHelpers;

const TOKEN_NAME = "Jack Sparrow"
const TOKEN_SYMBOL = "JWT"

const DEFAULT_MINT_AMOUNT = BigInt(1) * (BigInt(10) ** BigInt(18));

describe("SimpleToken", function () {
  async function deploySimpleTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const simpleToken = await ethers.deployContract("SimpleToken", [
      TOKEN_NAME,
      TOKEN_SYMBOL,
    ]);

    return { simpleToken, owner, addr1, addr2 };
  }

  describe("metadata", function () {
    it("Should have correct name and symbol", async function () {
      const { simpleToken } = await loadFixture(deploySimpleTokenFixture);

      expect(await simpleToken.name()).to.equal(TOKEN_NAME);
      expect(await simpleToken.symbol()).to.equal(TOKEN_SYMBOL);
    });
  });

  describe("Mint functions", function () {
    it("Should mint tokens to an address", async function () {
      const { simpleToken, owner, addr1 } = await loadFixture(
        deploySimpleTokenFixture
      );

      const amountBefore = await simpleToken.balanceOf(addr1.address)
      const amountInc = DEFAULT_MINT_AMOUNT;

      await expect(simpleToken.mint(addr1.address, amountInc)).to.changeTokenBalance(ethers, simpleToken, addr1.address, amountInc);
      expect(await simpleToken.balanceOf(addr1.address)).to.equal(amountBefore + amountInc);
    });

    it("Should only allow owner to mint", async function () {
      const { simpleToken, owner, addr1 } = await loadFixture(deploySimpleTokenFixture)

      const amount = DEFAULT_MINT_AMOUNT;

      await expect(simpleToken.connect(addr1).mint(owner.address, amount)).to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount");
      await expect(simpleToken.connect(owner).mint(addr1.address, amount)).to.changeTokenBalance(ethers, simpleToken, addr1.address, amount);
    });

    it("Should not allow minting to the zero address", async function () {
      const { simpleToken } = await loadFixture(deploySimpleTokenFixture)

      await expect(simpleToken.mint(ethers.ZeroAddress, DEFAULT_MINT_AMOUNT)).to.be.revert(ethers);
    });

    // default erc20 contract does allow this action
    it("Should still allow to mint 0 tokens", async function () {
      const { simpleToken, owner } = await loadFixture(deploySimpleTokenFixture)

      await expect(simpleToken.mint(owner.address, BigInt(0))).to.changeTokenBalance(ethers, simpleToken, owner.address, BigInt(0));
    });
  });
});