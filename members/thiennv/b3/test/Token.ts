import { describe, it } from "node:test";
import { parseUnits } from "viem";
import hre, { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Should deploy token with correct parameters", async function () {
    const tokenParams = {
      name: "MyToken",
      symbol: "MTK",
      initialSupply: parseUnits("1000000", 18),
    };

    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: tokenParams,
      },
    });

    const [owner] = await viem.getWalletClients();

    const endTime = await token.read.endtime();
    const testClient = await viem.getTestClient();

    // Increase time by 2 hours
    await testClient.increaseTime({ seconds: 2 * 60 * 60 });

    await viem.assertions.revertWith(
      token.write.buyTokens([1n], { value: 0n }),
      "Sale has ended"
    );
  });

  it("allows buy before endTime", async () => {
    const tokenParams = {
      name: "MyToken",
      symbol: "MTK",
      initialSupply: parseUnits("1000000", 18),
    };

    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: tokenParams,
      },
    });

    await token.write.buyTokens([1n], { value: 0n });
  });
});
