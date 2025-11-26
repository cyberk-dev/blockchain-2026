import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenFactoryModule", (m) => {
  const feeRecipt = m.getParameter("feeReceipt");
  const creationFee = m.getParameter("creationFee");
  const buyFee = m.getParameter("buyFee");
  const slope = m.getParameter('slope');
  const basePrice = m.getParameter('basePrice');
  const paymentToken = m.contract("PaymentToken", ["USD Coin", "USDC"], {
    id: "PaymentToken",
  });
  const factoryImpl = m.contract("TokenFactory", [], {
    id: "TokenFactoryImplementation",
  });
  const initializeCall = m.encodeFunctionCall(factoryImpl, "initialize", [
    feeRecipt,
    creationFee,
    buyFee,
    paymentToken,
    slope,
    basePrice,
  ]);
  const factoryProxy = m.contract(
    "ERC1967Proxy",
    [factoryImpl, initializeCall],
    {
      id: "TokenFactoryProxy",
    }
  );
  const tokenFactory = m.contractAt("TokenFactory", factoryProxy, {
    id: "TokenFactoryInstance",
  });

  return { tokenFactory, paymentToken };
});
