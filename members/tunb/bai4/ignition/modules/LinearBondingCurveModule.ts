import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LinearBondingCurveModule", (m) => {
  const slope = m.getParameter("slope", 10n ** 15n); // 0.001 ETH per token squared
  const initialPrice = m.getParameter("initialPrice", 10n ** 16n); // 0.01 ETH per token
  const addressUsdt = m.getParameter(
    "addressUsdt",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"
  ); // USDT contract address on Ethereum mainnet

  const token = m.contract("Token", [
    "Linear Bonding Curve Token",
    "LBCT",
    slope,
    initialPrice,
    addressUsdt,
  ]);

  return { token };
});
