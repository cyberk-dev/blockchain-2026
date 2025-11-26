# Lesson 2: Setting Up Your Hardhat Project Base

## Overview

This lesson guides you through setting up a complete Hardhat development environment from scratch. You'll learn how to initialize a project, configure dependencies, write and test smart contracts, deploy to testnets, and create custom Hardhat tasks.

By the end of this lesson, you'll have a production-ready project structure that serves as the foundation for all future blockchain development work.

---

## Prerequisites

Before starting, ensure you have:
- **Node.js** (v18 or higher) installed
- **pnpm** package manager installed (`npm install -g pnpm`)
- Basic understanding of TypeScript/JavaScript
- A Sepolia testnet RPC URL and private key (for deployment)

---

## Part A: Project Setup

### 1. Initialize Hardhat Project

Create a new Hardhat project using the official initialization command:

```bash
pnpm dlx hardhat --init
```

When prompted, select:
- select Hardhat 3 Beta (recommended for new projects)
- A TypeScript Hardhat project using Node Test Runner and Viem

### 2. Clean Up Default Files

Remove the default example files that come with Hardhat initialization:

```bash
rm contracts/Counter.sol
rm contracts/Counter.t.sol
rm test/Counter.ts
```

These are just examples and won't be needed for our project.

### 3. Install Required Dependencies

Install OpenZeppelin contracts, which provide battle-tested, audited smart contract libraries:

```bash
pnpm add -D @openzeppelin/contracts @openzeppelin/contracts-upgradeable
```

---

## Part B: Contract Development & Testing

### 1. Create the Token Contract

Create `contracts/Token.sol`:

```solidity
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }
}
```

### 2. Create the Deployment Module

Create `ignition/modules/Token.ts`:

```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenModule", (m) => {
  const sender = m.getAccount(0);

  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const initialSupply = m.getParameter("initialSupply");

  const token = m.contract("Token", [name, symbol, initialSupply]);

  return { token };
});
```

### 3. Write Tests

Create `test/Token.ts`:

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseUnits } from "viem";

import { network } from "hardhat";
import TokenModule from "../ignition/modules/Token.js";

describe("Token", async function () {
  const { viem, ignition } = await network.connect();
  const publicClient = await viem.getPublicClient();

  it("Deploy ignition", async function () {
    const { token } = await ignition.deploy(TokenModule, {
      parameters: {
        TokenModule: {
          name: "Cyberk",
          symbol: "CBK",
          initialSupply: parseUnits("100000000", 18),
        },
      }
    });
    console.log("token", token.address);
  });
});
```

### 4. Run Tests

Execute the test suite:

```bash
npx hardhat test test/Token.ts
```

You should see the deployment succeed and the token address printed to the console.

---

## Part C: Network Deployment

### 1. Configure Deployment Parameters

Create `token-parameter.json`:

```json
{
  "TokenModule": {
    "name": "Cyberk",
    "symbol": "CBK",
    "initialSupply": "10000000000000000000000000000"
  }
}
```

**Note:** `initialSupply` is in wei (smallest unit). For 10 billion tokens with 18 decimals, use `10000000000000000000000000000`.

### 2. Configure Network Credentials

Store your Sepolia network credentials securely using Hardhat's keystore:

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

### 3. Deploy to Sepolia

Deploy your contract to the Sepolia testnet:

```bash
npx hardhat ignition deploy ignition/modules/Token.ts --network sepolia --parameters token-parameter.json
```

**What Happens:**
- Hardhat compiles your contract
- Connects to Sepolia via your RPC URL
- Deploys using your private key
- Stores deployment artifacts in `ignition/deployments/`
- Returns the deployed contract address

---

## Part D: Custom Hardhat Tasks

### 1. Create a Transfer Task

Create `tasks/transfer-token.ts`:

```typescript
import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types/hre';
import TokenModule from '../ignition/modules/Token.js';
import parameters from '../token-parameter.json';

export const transferTokenTask = task('transfer-token', 'Transfer token')
  .setAction(async () => {
    return {
      default: async (_, hre: HardhatRuntimeEnvironment) => {
        const connection = await hre.network.connect();
        const { ignition, viem } = connection;
        const publicClient = await viem.getPublicClient();
        const { token } = await ignition.deploy(TokenModule, {
          parameters
        });

        const tx = await token.write.transfer([
          "0x4E60672a8DB169e322dF5B36599c77Bce3383998",
          1000n
        ]);
        console.log("transfer tx=", tx);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log("transfer success");
      },
    };
  })
  .build();
```

**Task Registration:**
The task is automatically registered in `hardhat.config.ts` via the `tasks` array:

```typescript
import { transferTokenTask } from "./tasks/transfer-token.js";

export default defineConfig({
  tasks: [transferTokenTask],
  // ... other config
});
```

### 2. Execute the Task

Run your custom task:

```bash
npx hardhat transfer-token --network sepolia
```

**Why Custom Tasks?**
- Automate repetitive operations
- Create project-specific commands
- Encapsulate complex workflows
- Improve developer experience

---

## Part E: Project Structure

Your final project structure should look like this:

```
02/
├── contracts/
│   └── Token.sol
├── ignition/
│   ├── modules/
│   │   └── Token.ts
│   └── deployments/
│       └── chain-11155111/  # Sepolia chain ID
├── tasks/
│   └── transfer-token.ts
├── test/
│   └── Token.ts
├── hardhat.config.ts
├── token-parameter.json
├── package.json
└── README.md
```

---

## Homework (MANDATORY)

Complete these tasks to reinforce your learning:

### Basic Requirements

1. **Rewrite Token Contract with Ignition Module**
   - Ensure your `Token.sol` matches the specification
   - Verify the deployment module works correctly

2. **Deploy Token Contract**
   - Deploy to Sepolia testnet
   - Verify the contract on Etherscan
   - Save the deployment address

3. **Create Transfer Task with Parameters**
   - Modify `transfer-token.ts` to accept `to` and `amount` as parameters
   - Use Hardhat's task parameter system
   - Test with different addresses and amounts

### Advanced Challenges

4. **TokenFactory Contract** ⭐
   - Create a `TokenFactory.sol` contract that can deploy new tokens
   - Implement a function to create tokens with custom names/symbols
   - Add events for token creation
   - Write tests for the factory

5. **Create Token Task** ⭐
   - Build a Hardhat task that uses the TokenFactory
   - Accept token parameters via command line
   - Deploy new tokens on-demand
   - Return the new token address

6. **Upgradeable Contract** ⭐⭐⭐⭐⭐⭐
   - Convert your Token contract to use OpenZeppelin's upgradeable pattern
   - Implement UUPS (Universal Upgradeable Proxy Standard)
   - Create upgrade tasks
   - Test upgrade functionality

---

## Common Issues & Solutions

### Issue: "Cannot find module '@openzeppelin/contracts'"
**Solution:** Run `pnpm install` to ensure all dependencies are installed.

### Issue: "Invalid RPC URL"
**Solution:** Verify your Sepolia RPC URL is correct. You can get a free one from [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/).

### Issue: "Insufficient funds"
**Solution:** Get Sepolia ETH from a [faucet](https://sepoliafaucet.com/).

### Issue: "Contract already deployed"
**Solution:** Hardhat Ignition tracks deployments. Use `--reset` flag to redeploy, or use the existing deployment address.

---

## Resources

- **Hardhat Documentation:** https://hardhat.org/docs
- **Hardhat Ignition Guide:** https://hardhat.org/ignition/docs
- **OpenZeppelin Contracts:** https://docs.openzeppelin.com/contracts
- **ERC20 Standard:** https://eips.ethereum.org/EIPS/eip-20
- **Sepolia Faucet:** https://sepoliafaucet.com/
- **Etherscan Sepolia:** https://sepolia.etherscan.io/

---

## Next Steps

Once you've completed this lesson, you should:
- Understand Hardhat project structure
- Be comfortable deploying contracts to testnets
- Know how to create and use custom tasks
- Have a solid foundation for more complex projects

**Remember:** This project structure is your template for all future blockchain development. Keep it organized, documented, and secure.
