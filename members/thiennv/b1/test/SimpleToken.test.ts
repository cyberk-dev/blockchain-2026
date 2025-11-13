import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("SimpleToken", function () {
  it("should mint tokens only by owner", async function () {
    const [owner, addr1] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("SimpleToken");
    const token = await Token.deploy("B1Token", "B1T");

    await token.mint(addr1.address, 1000);
    expect(await token.balanceOf(addr1.address)).to.equal(1000);

    await expect(
      token.connect(addr1).mint(addr1.address, 1000)
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});
