# HoneyChain REST API & Integration Guide

This guide documents how the **IoT/Backend Team**, **Frontend DApp Team**, and **Existing Government Portals** (KVIC, National Bee Board, State Honey Missions) interact with the HoneyChain Web3 Middleware layer.

---

## 1. System Integration Workflows

### 1.1 IoT / ESP32 Backend Workflow
```
ESP32 Sensor -> IoT Gateway / DB -> POST /api/v1/telemetry/commit -> POST /api/v1/batches
```
1. Collect sensor metrics: `temperature`, `humidity`, `weight`, `timestamp`.
2. Call `POST /api/v1/telemetry/commit` to generate the deterministic cryptographic commitment.
3. Call `POST /api/v1/ipfs/metadata` to pin initial batch metadata.
4. Call `POST /api/v1/batches` to mint the on-chain NFT in state `RAW_HARVEST` (0).
5. Store `tokenId`, `batchId`, `dataCommitment`, and `txHash` in the IoT database.

### 1.2 NABL Lab Certification Workflow
```
Lab Report Issued -> POST /api/v1/ipfs/upload -> POST /api/v1/verification/prove -> PATCH /api/v1/batches/:id/state
```
1. Upload testing certificate via `POST /api/v1/ipfs/upload`.
2. Generate ZK quality compliance proof via `POST /api/v1/verification/prove`.
3. Transition batch on-chain to `LAB_VERIFIED` (1) via `PATCH /api/v1/batches/:id/state`.

### 1.3 Buyer / Cooperative Trade Escrow Workflow
```
Buyer Creates Trade -> POST /api/v1/escrow -> (Upon Lab Verification) -> POST /api/v1/escrow/:id/release
```
1. Buyer locks funds in escrow for a batch using `POST /api/v1/escrow`.
2. When the batch achieves `LAB_VERIFIED` state, call `POST /api/v1/escrow/:id/release` to pay the beekeeper.

---

## 2. API Endpoints Reference

Base URL: `http://localhost:3000` (or configured gateway host).

### 2.1 System Health
`GET /health`
- **Response**:
```json
{
  "status": "HEALTHY",
  "service": "HoneyChain Web3 Middleware",
  "version": "1.0.0",
  "timestamp": "2026-08-31T20:00:00.000Z",
  "contracts": {
    "honeyBatchNFT": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "honeyEscrow": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "honeyZKVerifier": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  },
  "environment": "development"
}
```

---

### 2.2 Device Registration
`POST /api/v1/devices/register`
- **Request Body**:
```json
{
  "deviceId": "ESP32-HIVE-001",
  "hiveId": "HIVE-101",
  "clusterLocation": "Nilgiris Mountain Cluster, Tamil Nadu",
  "beekeeperId": "BK-IND-902"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Device registered successfully",
  "device": {
    "deviceId": "ESP32-HIVE-001",
    "hiveId": "HIVE-101",
    "clusterLocation": "Nilgiris Mountain Cluster, Tamil Nadu",
    "beekeeperId": "BK-IND-902",
    "registeredAt": 1756620000000,
    "status": "ACTIVE"
  }
}
```

---

### 2.3 Telemetry Intake & Commitment
`POST /api/v1/telemetry/commit`
- **Request Body**:
```json
{
  "deviceId": "ESP32-HIVE-001",
  "hiveId": "HIVE-101",
  "batchId": "HONEY-2026-NIL-001",
  "timestamp": 1756620000,
  "temperature": 34.25,
  "humidity": 61.4,
  "weight": 22.7
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "batchId": "HONEY-2026-NIL-001",
  "dataCommitment": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc",
  "canonicalRepresentation": "{\"batchId\":\"HONEY-2026-NIL-001\",\"deviceId\":\"ESP32-HIVE-001\",\"hiveId\":\"HIVE-101\",\"humidityScaled\":6140,\"temperatureScaled\":3425,\"timestamp\":1756620000,\"weightScaled\":2270}",
  "storedOffchain": true,
  "message": "Telemetry normalized and commitment generated successfully"
}
```

---

### 2.4 ZK Quality Proving & Verification
`POST /api/v1/verification/prove`
- **Request Body**:
```json
{
  "telemetry": {
    "deviceId": "ESP32-HIVE-001",
    "hiveId": "HIVE-101",
    "batchId": "HONEY-2026-NIL-001",
    "timestamp": 1756620000,
    "temperature": 34.25,
    "humidity": 61.4,
    "weight": 22.7
  },
  "constraints": {
    "minTemperature": 30.0,
    "maxTemperature": 38.0,
    "minHumidity": 45.0,
    "maxHumidity": 75.0
  }
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "batchId": "HONEY-2026-NIL-001",
  "zkProof": {
    "proof": "0x00000000000000000000000000000001...",
    "publicSignals": [
      "43129598284729182374982374982374",
      "3000",
      "3800",
      "4500",
      "7500",
      "1700000000",
      "1890000000",
      "981273918273918273918273918273"
    ],
    "protocol": "groth16",
    "circuitName": "HoneyQualityCircuit"
  },
  "onchainFormatted": {
    "proofBytes": "0x00000000000000000000000000000001...",
    "publicInputsCount": 8,
    "dataCommitmentHex": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc"
  },
  "message": "ZK proof generated successfully"
}
```

---

### 2.5 Batch Management (With Idempotency)
`POST /api/v1/batches`
- **Request Body**:
```json
{
  "batchId": "HONEY-2026-NIL-001",
  "hiveId": "HIVE-101",
  "beekeeperId": "BK-IND-902",
  "metadataURI": "ipfs://bafybeihoneyapibatch001",
  "dataCommitment": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc",
  "idempotencyKey": "MINT-HONEY-2026-NIL-001"
}
```
- **Response (201 Created on new mint / 200 OK on idempotent retry)**:
```json
{
  "success": true,
  "tokenId": "1",
  "batchId": "HONEY-2026-NIL-001",
  "txHash": "0x9596353087818d745408cd1aa3ed0aad6c2cc8ddb82c605a79649a059f4ce1f1",
  "batch": {
    "batchId": "HONEY-2026-NIL-001",
    "hiveId": "HIVE-101",
    "beekeeperId": "BK-IND-902",
    "metadataURI": "ipfs://bafybeihoneyapibatch001",
    "dataCommitment": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc",
    "state": 0,
    "tokenId": "1"
  },
  "idempotentReplay": false
}
```

`GET /api/v1/batches/:id`
- `:id` can be either the numeric `tokenId` (e.g. `1`) or the string `batchId` (e.g. `HONEY-2026-NIL-001`).
- **Response (200 OK)**:
```json
{
  "success": true,
  "tokenId": "1",
  "batch": {
    "batchId": "HONEY-2026-NIL-001",
    "hiveId": "HIVE-101",
    "beekeeperId": "BK-IND-902",
    "metadataURI": "ipfs://bafybeihoneyapibatch001",
    "dataCommitment": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc",
    "state": 0,
    "tokenId": "1"
  }
}
```

`PATCH /api/v1/batches/:id/state`
- **Request Body**:
```json
{
  "newState": 1
}
```
- **State Codes**: `0`: `RAW_HARVEST`, `1`: `LAB_VERIFIED`, `2`: `PACKAGED_RETAIL`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "tokenId": "1",
  "newState": 1,
  "txHash": "0x89abf...",
  "message": "Batch state updated successfully on-chain"
}
```

---

### 2.6 IPFS Storage Endpoints
`POST /api/v1/ipfs/metadata`
- **Request Body**:
```json
{
  "batchId": "HONEY-2026-NIL-001",
  "hiveId": "HIVE-101",
  "beekeeperId": "BK-IND-902",
  "clusterLocation": "Nilgiris Mountain Cluster, Tamil Nadu",
  "harvestDate": "2026-08-15",
  "floralSource": "Wild Multifloral Blossom",
  "telemetryCommitment": "0x09867bca9c1ea4e64f89d380e2ea8a5ea5ef4dca02e5b0b14c330f622be226fc",
  "nablReport": {
    "labName": "National Honey Testing Lab (NABL Accredited)",
    "accreditationNumber": "NABL-TC-8891",
    "testDate": "2026-08-18",
    "moisturePercentage": 17.5,
    "fructoseGlucoseRatio: 1.24,
    "sucrosePercentage": 2.0,
    "hmfContent": 11.2,
    "pollenAnalysis": "Wild flora dominant",
    "adulterationDetected": false,
    "status": "PASSED"
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "cid": "bafybeihoney...",
  "ipfsUri": "ipfs://bafybeihoney...",
  "gatewayUrl": "https://gateway.pinata.cloud/ipfs/bafybeihoney...",
  "size": 782,
  "message": "Metadata pinned to IPFS successfully"
}
```

---

### 2.7 Escrow Management Endpoints
`POST /api/v1/escrow`
- **Request Body**:
```json
{
  "batchId": "HONEY-2026-NIL-001",
  "tokenId": "1",
  "sellerAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  "amountEth": "0.5",
  "releaseTimeoutSeconds": 604800
}
```

`POST /api/v1/escrow/:id/release`
- Releases locked funds to the beekeeper once quality is certified.
