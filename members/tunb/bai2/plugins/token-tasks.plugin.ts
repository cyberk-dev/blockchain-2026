import type { HardhatPlugin } from "hardhat/types/plugins";
import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";

const transferTokenTask = task("transfer-token", "Transfers tokens from one account to another")
.addOption({
  name: "token",
  description: "The address of the token contract",
    type: ArgumentType.STRING,
    defaultValue: "",
})
.addOption({
  name: "to",
    description: "The recipient address",
    type: ArgumentType.STRING,
    defaultValue: "",
})
.addOption({ name: "amount",
    description: "The amount of tokens to transfer",
    type: ArgumentType.STRING,
    defaultValue: "0", })
.setAction(() => import("./tasks/transfer-token.js")).build();

const tokenTasksPlugin: HardhatPlugin = {
  id: "token-tasks",
  tasks: [transferTokenTask],
};

export default tokenTasksPlugin;