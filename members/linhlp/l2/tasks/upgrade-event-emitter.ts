import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import UpgradeEventEmitterModule from "../ignition/modules/UpgradeEventEmitter.js";

export const upgradeEventEmitterTask = task(
  "upgrade-event-emitter",
  "Upgrade EventEmitter to EventEmitterV2"
)
  .setAction(async () => {
    return {
      default: async (args: {}, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition } = connection;
        await ignition.deploy(UpgradeEventEmitterModule);
      },
    };
  })
  .build();
