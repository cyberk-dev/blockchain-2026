import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import TokenModule from "./Token.js";

export default buildModule("CyberkModule", (m) => {
  const { token } = m.useModule(TokenModule);

  return { token };
});
