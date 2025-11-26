import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import TokenFactoryModule from "../ignition/modules/TokenFactory.js";

export const deployFactoryTask = task("deploy-factory", "Deploy TokenFactory via Ignition")
  .setAction(async () => {
    return {
      default: async (_: {}, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition } = connection;
        const { factory }: { factory: { address: `0x${string}` } } =
          await ignition.deploy(TokenFactoryModule, {});
        console.log("TokenFactory deployed at:", factory.address);
      },
    };
  })
  .build();


