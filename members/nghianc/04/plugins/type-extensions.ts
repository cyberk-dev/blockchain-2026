import "hardhat/types/config";

declare module "hardhat/types/config" {
  export interface HardhatNetworkHooksUserConfig {
    erc20BalancesHaveChanged?: {
      enabled: boolean;
    };
  }
}
