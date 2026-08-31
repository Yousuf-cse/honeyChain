# HoneyChain Web3 Deployment & Operations Manual

This manual provides step-by-step instructions for running tests, deploying smart contracts, seeding demo batches, and operating the HoneyChain REST API gateway.

---

## 1. Prerequisites

- **Node.js**: v20.x or higher
- **Package Manager**: `pnpm` (recommended) or `npm`
- **Compiler**: Hardhat 3.15.x with Solidity 0.8.34

---

## 2. Environment Configuration

1. Copy the example configuration template:
   ```bash
   cp .env.example .env
   ```

2. Key Configuration Variables in `.env`:
   ```ini
   # Blockchain RPC
   RPC_URL=http://127.0.0.1:8545
   CHAIN_ID=31337
   PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

   # Deployed Contract Addresses (Updated after deploy)
   HONEY_BATCH_NFT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
   HONEY_ESCROW_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   ZK_VERIFIER_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

   # Pinata IPFS (Server-Side Only)
   PINATA_JWT=your_pinata_jwt_token_here
   PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs
   MOCK_IPFS=false

   # REST Gateway
   PORT=3000
   ```

---

## 3. Building & Testing

### 3.1 Compile Smart Contracts
```bash
pnpm hardhat compile
```

### 3.2 Run All Tests
```bash
pnpm hardhat test
```
Runs both Foundry-compatible Solidity tests (`contracts/*.t.sol`) and TypeScript integration tests (`test/*.test.ts`).

### 3.3 TypeScript Typecheck
```bash
npx tsc --noEmit
```

---

## 4. Local Deployment & Demo Seeding

### 4.1 Deploy Smart Contracts Locally
```bash
pnpm hardhat run scripts/deploy.ts
```
Deploys `HoneyZKVerifier`, `HoneyBatchNFT`, and `HoneyEscrow`, exporting deployed addresses to `deployments.json`.

### 4.2 Seed Complete Demo Lifecycle Scenario
```bash
pnpm hardhat run scripts/seedDemo.ts
```
Executes a multi-batch demo scenario:
- **Batch 1 (RAW_HARVEST)**: Nilgiris Multifloral Honey with raw telemetry commitment and IPFS metadata.
- **Batch 2 (LAB_VERIFIED + ESCROW)**: Coorg Coffee Blossom Honey with ZK-SNARK quality proof, NABL lab report, and 0.5 ETH escrow deposit.
- **Batch 3 (PACKAGED_RETAIL)**: Sundarbans Mangrove Honey fully packaged and retail certified.

---

## 5. Starting the REST API Middleware

Run the standalone REST API server:
```bash
npx tsx server/index.ts
```
Access the REST endpoints at:
- **Gateway**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Batches**: `http://localhost:3000/api/v1/batches`

---

## 6. Live L2 / Testnet Deployment

To deploy to EVM L2 testnets (Sepolia, Optimism Sepolia, Base Sepolia):

1. Set your network configuration in `hardhat.config.ts` or set config variables:
   ```bash
   npx hardhat keystore set SEPOLIA_PRIVATE_KEY
   npx hardhat keystore set SEPOLIA_RPC_URL
   ```

2. Run deployment with network flag:
   ```bash
   pnpm hardhat run scripts/deploy.ts --network sepolia
   ```

3. Update `.env` with the newly deployed contract addresses on Sepolia/L2.
