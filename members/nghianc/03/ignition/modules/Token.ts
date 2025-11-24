import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Token Ignition Module with progressive pricing support
 * Parameters:
 * - name: Token name
 * - symbol: Token symbol
 * - initialSupply: Initial supply minted to deployer
 * - endTime: Unix timestamp when token sale ends
 * - slope: Price increase per token sold (in wei)
 * - startingPrice: Base price of first token (in wei)
 */
export default buildModule("TokenModule", (m) => {
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");
  const endTime = m.getParameter("endTime");
  const slope = m.getParameter("slope");
  const startingPrice = m.getParameter("startingPrice");

  const token = m.contract("Token", [
    name,
    symbol,
    initialSupply,
    endTime,
    slope,
    startingPrice,
  ]);

  return { token };
});
