import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LPTokenModule", (m) => {
	// Deploy Token A
	const tokenAImpl = m.contract("Token", [], { id: "TokenAImpl" });
	const tokenAProxy = m.contract(
		"ERC1967Proxy",
		[
			tokenAImpl,
			m.encodeFunctionCall(tokenAImpl, "initialize", [
				"Token A",
				"TKA",
				m.getAccount(0), // owner
			]),
		],
		{ id: "TokenAProxy" }
	);
	const tokenA = m.contractAt("Token", tokenAProxy, { id: "TokenA" });

	// Deploy Token B
	const tokenBImpl = m.contract("Token", [], { id: "TokenBImpl" });
	const tokenBProxy = m.contract(
		"ERC1967Proxy",
		[
			tokenBImpl,
			m.encodeFunctionCall(tokenBImpl, "initialize", [
				"Token B",
				"TKB",
				m.getAccount(0), // owner
			]),
		],
		{ id: "TokenBProxy" }
	);
	const tokenB = m.contractAt("Token", tokenBProxy, { id: "TokenB" });

	// Deploy LPToken with tokenA and tokenB addresses
	// Note: LPToken constructor accepts tokens in any order
	// Ignition will automatically resolve contract instances to addresses
	const lpToken = m.contract("LPToken", [tokenAProxy, tokenBProxy], {
		id: "LPToken",
	});

	return {
		tokenA,
		tokenB,
		lpToken,
	};
});
