import { expect } from "chai";
import { network } from "hardhat";
import { SimpleToken } from "../types/ethers-contracts/SimpleToken.js";

const { ethers } = await network.connect();

const getTestingContext = async <T>(contractName: string, args: any[]) => {
  const contractFactory = await ethers.getContractFactory(contractName);
  const contract = await contractFactory.deploy(...args);
  await contract.waitForDeployment();
  const signers = await ethers.getSigners();
  return {
    contract: contract as T,
    signers,
  } as const;
};

describe("SimpleToken", function () {
  it("Should mint tokens to an address", async function () {
    const {
      contract: simpleToken,
      signers: [owner, recipient],
    } = await getTestingContext<SimpleToken>("SimpleToken", [
      "DucHMToken",
      "DucHM",
    ]);

    const amount = ethers.parseEther("100");

    await simpleToken.mint(recipient.address, amount);

    const balance = await simpleToken.balanceOf(recipient.address);

    expect(balance).to.equal(amount);
  });

  it("Should only allow owner to mint", async function () {
    const {
      contract: simpleToken,
      signers: [owner, nonOwner, recipient],
    } = await getTestingContext<SimpleToken>("SimpleToken", [
      "DucHMToken",
      "DucHM",
    ]);

    const amount = ethers.parseEther("100");

    await expect(
      simpleToken.connect(nonOwner).mint(recipient.address, amount)
    ).to.be.revertedWithCustomError(simpleToken, "OwnableUnauthorizedAccount");
  });

  it("Should have correct name and symbol", async function () {
    const { contract: simpleToken } = await getTestingContext<SimpleToken>(
      "SimpleToken",
      ["DucHMToken", "DucHM"]
    );

    expect(await simpleToken.name()).to.equal("DucHMToken");
    expect(await simpleToken.symbol()).to.equal("DucHM");
  });

  it("Should increase total supply after minting", async function () {
    const {
      contract: simpleToken,
      signers: [owner, recipient],
    } = await getTestingContext<SimpleToken>("SimpleToken", [
      "DucHMToken",
      "DucHM",
    ]);

    const amount = ethers.parseEther("100");
    const initialSupply = await simpleToken.totalSupply();

    await simpleToken.mint(recipient.address, amount);

    const newSupply = await simpleToken.totalSupply();
    expect(newSupply).to.equal(initialSupply + amount);
  });
});
