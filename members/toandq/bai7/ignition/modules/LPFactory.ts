import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LPFactoryModule", (m) => {
	const lpFactory = m.contract("LPFactory", [], { id: "LPFactory" });

	return {
		lpFactory,
	};
});
