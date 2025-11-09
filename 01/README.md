# Lesson 1: The "Solidity Supersonic" Foundation 

## 1. The "Why": The 4 Pillars & The Auditor's Mindset

Why are we here? Because blockchain code is unlike anything you've ever written. It's built on 4 pillars, and they are the reason why one small "bug" can burn millions of dollars.

1.  **🏛️ Decentralization:**
    * **What it means:** No one owns the network. There is no "super admin".
    * **Consequence for Devs:** Your code runs on thousands of nodes. You can't just "shut down the server" or "hotfix" it easily.

2.  **⛓️ Immutability:**
    * **What it means:** Once deployed, the code (logic) and data (history) are **IMMUTABLE** (CANNOT BE CHANGED).
    * **Consequence for Devs:** "Deploy and Pray" is real. A deployed logic bug exists forever. This is why **Upgradeable Contracts** (Proxy Pattern) are the mandatory standard we will use.

3.  **🔍 Transparency:**
    * **What it means:** Everyone can read the code (bytecode) and view every transaction (Etherscan).
    * **Consequence for Devs:** Hackers can also read your code. Any vulnerability will be scrutinized. There is no "security by obscurity".

4.  **🛡️ Security:**
    * **What it means:** The network is secured by cryptography and game theory (PoW/PoS).
    * **Consequence for Devs:** The network is secure, but *the logic inside your contract is not*. You are the weakest link.

> **The Auditor's Mindset:** With these 4 pillars, we must code with these assumptions:
> * Every user input is **malicious**.
> * Our code **will be read** and attacked by hackers.
> * Mistakes are **permanent** and extremely **costly**.

---

## 2. The Paradigm Shift: Why Your BE/FE Skills Are Dangerous

Your good BE/FE coding habits can get you killed here.

* **It's a State Machine, Not a Database:**
    * BE/FE: `UPDATE users SET balance = 100 WHERE id = 1;` (Update 1 row).
    * Blockchain: `balance[user1] = 100;` (Create a new *transaction*, write a new *state*). There's no "update," only "overwriting" with a new state.

* **Gas = Money (A Lot of Money):**
    * Every line of code costs the user money.
    * `storage` (writing to state, `SSTORE`): **Extremely expensive.** Avoid at all costs.
    * `memory` (temp variable in a function): Cheap.
    * `calldata` (function input): Super cheap, and *read-only*.
    * **Gas optimization is mandatory**, not "nice-to-have".

* **Visibility & Security (Critically Important):**
    * `public`: Anyone can call (users, other contracts). Auto-creates a getter.
    * `external`: Only *outside* the contract can call. Cheaper than `public` for inputs.
    * `internal`: Only this contract and child contracts (inheritance) can call.
    * `private`: Only this contract can call.
    * **Classic blunder:** Wrote a `withdrawAll()` function and forgot `internal`? You just let the entire world withdraw your money.

* **Error Handling (Revert-all-on-failure):**
    * BE/FE: Use `try-catch`, log the error, continue running.
    * Blockchain: If an error occurs, the entire transaction **rolls back** (except for gas spent).
    * `require(condition, "Error message");` // Check user input.
    * `revert CustomError();` // Business logic error.

---



## 3. The Code: Core Syntax

This is the bare minimum you need to know to read code.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import (Like JS/TS)
import "@openzeppelin/contracts/access/Ownable.sol";

// A Contract is like a "Class"
contract MyContract is Ownable {
    // 1. State Variables (Stored forever on-chain, VERY EXPENSIVE)
    uint256 public myNumber; // "public" auto-creates a getter
    address public owner; // `address` variable
    mapping(address => uint256) public balances; // Like a HashMap
    
    struct User {
        uint256 id;
        bool registered;
    }
    mapping(address => User) public users;

    // 2. Events (Communicating with FE/BE via logs)
    event ValueChanged(address indexed who, uint256 newValue);

    // 3. Constructor (Runs only once on deploy)
    constructor(uint256 initialNumber) {
        myNumber = initialNumber;
        owner = msg.sender; // msg.sender: The caller of this function
    }

    // 4. Functions (Logic)

    // `external` + `payable`: Allows outsiders to call AND send ETH
    function deposit() external payable {
        balances[msg.sender] += msg.value; // msg.value: The amount of ETH sent
    }

    // `external` + `view`: Only reads state, no gas cost (when called from FE)
    function getMyBalance() external view returns (uint256) {
        return balances[msg.sender];
    }

    // `public`: Anyone can call (users, other contracts)
    function setValue(uint256 _newValue) public {
        // 5. Modifier (Runs a check before the function body)
        require(msg.sender == owner, "Not the owner!");
        
        myNumber = _newValue;
        emit ValueChanged(msg.sender, _newValue); // Emit the event
    }
}
```

---

## 4. The "Don't Be a Hero" Toolkit (15 minutes)

* **Don't reinvent the wheel (Especially not the security wheel):**
    * Introduce **OpenZeppelin (OZ)**: The industry standard. Already audited.
    * Need access control? Use `Ownable.sol` or `AccessControl.sol`.
    * Need reentrancy protection? Use `ReentrancyGuard.sol`.
    * Need a token? Use `ERC20.sol`, `ERC721.sol`.

* **Introducing Upgradeability (Mandatory):**
    * Because code is *immutable*, we use the Proxy Pattern.
    * User interacts with the **Proxy Contract** (Storage).
    * The Proxy uses `DELEGATECALL` (super dangerous) to run logic from the **Logic Contract**.
    * We will use **OZ Upgradeable (UUPS)**. It lets you swap in a new `Logic Contract` to fix bugs.

* **Tooling:** Ditch Remix (it's just for learning).
    * Install **Hardhat**: The industry-standard environment for development, testing (JavaScript/TypeScript), and deployment.

---

## 5. Homework (MANDATORY)

This session is meaningless if you don't do the homework.

1.  **Install NodeJS & Hardhat:** (via `hardhat.org`)
2.  Create a folder, run `npm init`, `npm install hardhat`.
3.  Run `npx hardhat` and choose "Create a TypeScript project" (or JavaScript).
4.  Go to `contracts/`, create a `SimpleToken.sol` file that inherits `ERC20.sol` and `Ownable.sol` from OpenZeppelin (remember to `npm install @openzeppelin/contracts`).
    * The `constructor()` should accept `name` and `symbol`.
    * Add a `mint(address to, uint26 amount)` function that can only be called by the `owner` (use the `modifier` from `Ownable`).
5.  Go to `test/`, create a `SimpleToken.test.ts` (or `.js`) file and write a basic test (using Ethers.js) for your `mint()` function.

---

## 6. Resources (For further study)

* **Solidity Docs (Official):** `https://docs.soliditylang.org/en/v0.8.30/` (This is the "bible", you must read it)
* **Solidity by Example:** `https://solidity-by-example.org/` (Learn by example, extremely useful)
* **RareSkills (Learn Solidity):** `https://rareskills.io/learn-solidity` (In-depth learning material)