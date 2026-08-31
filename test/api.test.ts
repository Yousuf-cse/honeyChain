import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import request from "supertest";
import hre from "hardhat";
import { createApp } from "../server/app.js";
import { BatchService } from "../onchain/services/batchService.js";
import { EscrowService } from "../onchain/services/escrowService.js";
import { generateTelemetryCommitment } from "../onchain/utils/commitment.js";
import type { TelemetryReading } from "../onchain/types/index.js";

describe("REST API Integration Suite", async function () {
  let app: any;
  let batchService: BatchService;
  let escrowService: EscrowService;
  let viem: any;
  let deployer: any;
  let buyer: any;
  let seller: any;

  beforeEach(async function () {
    const connection = await hre.network.connect();
    viem = connection.viem;

    const wallets = await viem.getWalletClients();
    deployer = wallets[0];
    buyer = wallets[1];
    seller = wallets[2];

    const honeyBatchNFT = await viem.deployContract("HoneyBatchNFT");
    const honeyEscrow = await viem.deployContract("HoneyEscrow");

    batchService = new BatchService({
      clients: {
        publicClient: await viem.getPublicClient(),
        walletClient: deployer,
        account: deployer.account,
      },
      contractAddress: honeyBatchNFT.address,
    });

    escrowService = new EscrowService({
      clients: {
        publicClient: await viem.getPublicClient(),
        walletClient: deployer,
        account: deployer.account,
      },
      contractAddress: honeyEscrow.address,
    });

    app = createApp({
      batchService,
      escrowService,
    });
  });

  describe("System & Health", function () {
    it("GET /health should return HEALTHY status", async function () {
      const res = await request(app).get("/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "HEALTHY");
      assert.equal(res.body.service, "HoneyChain Web3 Middleware");
    });
  });

  describe("Device Registration", function () {
    it("POST /api/v1/devices/register should register a new hive sensor", async function () {
      const payload = {
        deviceId: "ESP32-KERALA-001",
        hiveId: "HIVE-WAYANAD-101",
        clusterLocation: "Wayanad Forest Honey Cluster",
        beekeeperId: "BK-KL-055",
      };

      const res = await request(app).post("/api/v1/devices/register").send(payload);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.device.deviceId, payload.deviceId);
    });

    it("POST /api/v1/devices/register should reject incomplete payload", async function () {
      const res = await request(app).post("/api/v1/devices/register").send({
        deviceId: "ESP32-INCOMPLETE",
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe("Telemetry & Commitment API", function () {
    it("POST /api/v1/telemetry/commit should calculate deterministic commitment", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-HIVE-001",
        hiveId: "HIVE-001",
        batchId: "HONEY-API-001",
        timestamp: 1756620000,
        temperature: 34.5,
        humidity: 62.0,
        weight: 23.5,
      };

      const res = await request(app).post("/api/v1/telemetry/commit").send(telemetry);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.dataCommitment, /^0x[a-fA-F0-9]{64}$/);
      assert.equal(res.body.storedOffchain, true);
    });
  });

  describe("ZK Proving & Verification API", function () {
    it("POST /api/v1/verification/prove should generate a valid ZK proof payload", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-HIVE-001",
        hiveId: "HIVE-001",
        batchId: "HONEY-ZK-001",
        timestamp: 1756620000,
        temperature: 34.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const res = await request(app).post("/api/v1/verification/prove").send({ telemetry });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.zkProof);
      assert.equal(res.body.zkProof.protocol, "groth16");
      assert.equal(res.body.onchainFormatted.publicInputsCount, 8);
    });

    it("POST /api/v1/verification/prove should reject invalid telemetry metrics", async function () {
      const invalidTelemetry: TelemetryReading = {
        deviceId: "ESP32-HIVE-001",
        hiveId: "HIVE-001",
        batchId: "HONEY-ZK-BAD",
        timestamp: 1756620000,
        temperature: 55.0, // Exceeds honey temperature bound
        humidity: 60.0,
        weight: 20.0,
      };

      const res = await request(app).post("/api/v1/verification/prove").send({ telemetry: invalidTelemetry });
      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
    });
  });

  describe("Batch Minting, Lifecycle & Idempotency", function () {
    const batchPayload = {
      batchId: "HONEY-API-BATCH-001",
      hiveId: "HIVE-101",
      beekeeperId: "BK-42",
      metadataURI: "ipfs://bafybeihoneyapibatch001",
      dataCommitment: "0x1111111111111111111111111111111111111111111111111111111111111111",
    };

    it("POST /api/v1/batches should mint a new batch on-chain", async function () {
      const res = await request(app).post("/api/v1/batches").send(batchPayload);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.batchId, batchPayload.batchId);
      assert.equal(res.body.tokenId, "1");
      assert.equal(res.body.idempotentReplay, false);
    });

    it("POST /api/v1/batches should idempotently return existing token on retry", async function () {
      // First mint
      await request(app).post("/api/v1/batches").send(batchPayload);

      // Duplicate retry
      const retryRes = await request(app).post("/api/v1/batches").send(batchPayload);
      assert.equal(retryRes.status, 200);
      assert.equal(retryRes.body.success, true);
      assert.equal(retryRes.body.tokenId, "1");
      assert.equal(retryRes.body.idempotentReplay, true);
    });

    it("GET /api/v1/batches/:id should query by numeric tokenId and string batchId", async function () {
      await request(app).post("/api/v1/batches").send(batchPayload);

      // Query by tokenId (numeric)
      const resNum = await request(app).get("/api/v1/batches/1");
      assert.equal(resNum.status, 200);
      assert.equal(resNum.body.batch.batchId, batchPayload.batchId);

      // Query by batchId (string)
      const resStr = await request(app).get(`/api/v1/batches/${batchPayload.batchId}`);
      assert.equal(resStr.status, 200);
      assert.equal(resStr.body.batch.batchId, batchPayload.batchId);
      assert.equal(resStr.body.tokenId, "1");
    });

    it("PATCH /api/v1/batches/:id/state should transition state", async function () {
      await request(app).post("/api/v1/batches").send(batchPayload);

      // Move to LAB_VERIFIED (1)
      const res = await request(app)
        .patch(`/api/v1/batches/${batchPayload.batchId}/state`)
        .send({ newState: 1 });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.newState, 1);
    });
  });

  describe("IPFS API Endpoints", function () {
    it("POST /api/v1/ipfs/metadata should construct and pin ERC-721 metadata", async function () {
      const metaReq = {
        batchId: "HONEY-IPFS-001",
        hiveId: "HIVE-001",
        beekeeperId: "BK-001",
        clusterLocation: "Nilgiris Cluster",
        telemetryCommitment: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        nablReport: {
          labName: "National Honey Testing Lab",
          accreditationNumber: "NABL-1234",
          testDate: "2026-08-20",
          moisturePercentage: 17.5,
          fructoseGlucoseRatio: 1.2,
          sucrosePercentage: 2.0,
          hmfContent: 11.0,
          pollenAnalysis: "Multifloral",
          adulterationDetected: false,
          status: "PASSED",
        },
      };

      const res = await request(app).post("/api/v1/ipfs/metadata").send(metaReq);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.ipfsUri.startsWith("ipfs://"));
      assert.equal(res.body.metadata.name, "HoneyChain Batch #HONEY-IPFS-001");
    });
  });

  describe("Escrow API Endpoints", function () {
    it("POST /api/v1/escrow should create an escrow agreement", async function () {
      const escrowReq = {
        batchId: "HONEY-ESCROW-API-001",
        tokenId: "1",
        sellerAddress: seller.account.address,
        amountEth: "0.1",
        releaseTimeoutSeconds: 3600,
      };

      const res = await request(app).post("/api/v1/escrow").send(escrowReq);
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.escrowId, "1");

      const getRes = await request(app).get("/api/v1/escrow/1");
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.escrow.batchId, escrowReq.batchId);
    });
  });
});
