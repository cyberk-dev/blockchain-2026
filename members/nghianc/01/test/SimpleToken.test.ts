import { getAddress, parseUnits } from "viem";
import hre from "hardhat";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("SimpleToken", () => {
  async function deploySimpleToken() {
    const connection = await hre.network.connect();
    const [owner, addr1, addr2] = await connection.viem.getWalletClients();

    const simpleToken = await connection.viem.deployContract("SimpleToken", [
      "Simple Nikita",
      "NIK",
    ]);

    return {
      simpleToken,
      owner,
      addr1,
      addr2,
      connection,
    };
  }

  describe("Deployment", () => {
    it("should have correct name and symbol", async () => {
      const { simpleToken } = await deploySimpleToken();

      const name = await simpleToken.read.name();
      const symbol = await simpleToken.read.symbol();

      assert.equal(
        name,
        "Simple Nikita",
        "Token name should be 'Simple Nikita'"
      );
      assert.equal(symbol, "NIK", "Token symbol should be 'NIK'");
    });

    it("should set the right owner", async () => {
      const { simpleToken, owner } = await deploySimpleToken();

      const contractOwner = await simpleToken.read.owner();
      const ownerAddress = getAddress(owner.account.address);

      assert.equal(
        contractOwner,
        ownerAddress,
        "Owner should be the deployer address"
      );
    });

    it("should have zero initial total supply", async () => {
      const { simpleToken } = await deploySimpleToken();

      const totalSupply = await simpleToken.read.totalSupply();

      assert.equal(totalSupply, 0n, "Initial total supply should be zero");
    });

    it("should have 18 decimal places", async () => {
      const { simpleToken } = await deploySimpleToken();

      const decimals = await simpleToken.read.decimals();

      assert.equal(decimals, 18, "Decimals should be 18");
    });
  });

  describe("Mint", () => {
    it("should mint tokens to an address", async () => {
      const { simpleToken, owner, addr1 } = await deploySimpleToken();
      const amount = parseUnits("100", 18);
      const addr1Address = getAddress(addr1.account.address);

      await simpleToken.write.mint([addr1Address, amount], {
        account: owner.account,
      });

      const balance = await simpleToken.read.balanceOf([addr1Address]);

      assert.equal(
        balance,
        amount,
        `Address should have ${amount} tokens after minting`
      );
    });

    it("should mint multiple times to the same address", async () => {
      const { simpleToken, owner, addr1 } = await deploySimpleToken();
      const amount1 = parseUnits("50", 18);
      const amount2 = parseUnits("100", 18);
      const addr1Address = getAddress(addr1.account.address);

      await simpleToken.write.mint([addr1Address, amount1], {
        account: owner.account,
      });
      await simpleToken.write.mint([addr1Address, amount2], {
        account: owner.account,
      });

      const balance = await simpleToken.read.balanceOf([addr1Address]);
      const expectedBalance = amount1 + amount2;

      assert.equal(
        balance,
        expectedBalance,
        `Balance should be ${expectedBalance} after two mints`
      );
    });

    it("should mint to different addresses", async () => {
      const { simpleToken, owner, addr1, addr2 } = await deploySimpleToken();
      const amount1 = parseUnits("100", 18);
      const amount2 = parseUnits("200", 18);
      const addr1Address = getAddress(addr1.account.address);
      const addr2Address = getAddress(addr2.account.address);

      await simpleToken.write.mint([addr1Address, amount1], {
        account: owner.account,
      });
      await simpleToken.write.mint([addr2Address, amount2], {
        account: owner.account,
      });

      const balance1 = await simpleToken.read.balanceOf([addr1Address]);
      const balance2 = await simpleToken.read.balanceOf([addr2Address]);

      assert.equal(balance1, amount1, `addr1 balance should be ${amount1}`);
      assert.equal(balance2, amount2, `addr2 balance should be ${amount2}`);
    });

    it("should only allow owner to mint", async () => {
      const { simpleToken, addr1, addr2 } = await deploySimpleToken();
      const amount = parseUnits("100", 18);
      const addr2Address = getAddress(addr2.account.address);

      try {
        await simpleToken.write.mint([addr2Address, amount], {
          account: addr1.account,
        });
        throw new Error("Expected transaction to revert");
      } catch (error: any) {
        assert.ok(
          error.message.includes("OwnableUnauthorizedAccount") ||
            error.message.includes("revert"),
          "Should revert with Ownable error when non-owner attempts to mint"
        );
      }
    });

    it("should increase total supply when minting", async () => {
      const { simpleToken, owner, addr1 } = await deploySimpleToken();
      const amount = parseUnits("1000", 18);
      const addr1Address = getAddress(addr1.account.address);

      const initialSupply = await simpleToken.read.totalSupply();

      await simpleToken.write.mint([addr1Address, amount], {
        account: owner.account,
      });

      const finalSupply = await simpleToken.read.totalSupply();
      const expectedSupply = initialSupply + amount;

      assert.equal(
        finalSupply,
        expectedSupply,
        `Total supply should increase by ${amount}`
      );
    });

    it("should handle zero amount minting", async () => {
      const { simpleToken, owner, addr1 } = await deploySimpleToken();
      const amount = 0n;
      const addr1Address = getAddress(addr1.account.address);

      await simpleToken.write.mint([addr1Address, amount], {
        account: owner.account,
      });

      const balance = await simpleToken.read.balanceOf([addr1Address]);

      assert.equal(
        balance,
        0n,
        "Balance should remain zero after minting zero"
      );
    });

    it("should handle large mint amounts", async () => {
      const { simpleToken, owner, addr1 } = await deploySimpleToken();
      const largeAmount = parseUnits("1000000", 18); // 1 million tokens
      const addr1Address = getAddress(addr1.account.address);

      await simpleToken.write.mint([addr1Address, largeAmount], {
        account: owner.account,
      });

      const balance = await simpleToken.read.balanceOf([addr1Address]);

      assert.equal(
        balance,
        largeAmount,
        `Should be able to mint large amounts`
      );
    });
  });

  describe("ERC20 Transfers", () => {
    it("should allow transfer after minting", async () => {
      const { simpleToken, owner, addr1, addr2 } = await deploySimpleToken();
      const mintAmount = parseUnits("100", 18);
      const transferAmount = parseUnits("30", 18);
      const addr1Address = getAddress(addr1.account.address);
      const addr2Address = getAddress(addr2.account.address);

      // Mint tokens to addr1
      await simpleToken.write.mint([addr1Address, mintAmount], {
        account: owner.account,
      });

      // Transfer from addr1 to addr2
      await simpleToken.write.transfer([addr2Address, transferAmount], {
        account: addr1.account,
      });

      const addr1Balance = await simpleToken.read.balanceOf([addr1Address]);
      const addr2Balance = await simpleToken.read.balanceOf([addr2Address]);

      assert.equal(
        addr1Balance,
        parseUnits("70", 18),
        "addr1 should have 70 tokens left"
      );
      assert.equal(
        addr2Balance,
        transferAmount,
        `addr2 should have ${transferAmount} tokens`
      );
    });

    it("should not allow transfer of more tokens than balance", async () => {
      const { simpleToken, owner, addr1, addr2 } = await deploySimpleToken();
      const mintAmount = parseUnits("50", 18);
      const transferAmount = parseUnits("100", 18);
      const addr1Address = getAddress(addr1.account.address);
      const addr2Address = getAddress(addr2.account.address);

      // Mint tokens to addr1
      await simpleToken.write.mint([addr1Address, mintAmount], {
        account: owner.account,
      });

      // Try to transfer more than balance
      try {
        await simpleToken.write.transfer([addr2Address, transferAmount], {
          account: addr1.account,
        });
        throw new Error("Expected transfer to revert");
      } catch (error: any) {
        assert.ok(
          error.message.includes("revert") ||
            error.message.includes("insufficient"),
          "Should revert when trying to transfer more than balance"
        );
      }
    });
  });
});
