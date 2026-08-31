import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import hre from "hardhat";
import { keccak256, stringToHex } from "viem";
import { zkService } from "../onchain/services/zkService.js";
import type { TelemetryReading } from "../onchain/types/index.js";

describe("HoneyZKVerifier", async function () {
  let zkVerifier: any;
  let viem: any;
  let deployer: any;
  let unauthorizedUser: any;
  const initialVk = keccak256(stringToHex("VK_HONEY_QUALITY_CIRCUIT_V1"));

  beforeEach(async function () {
    const connection = await hre.network.connect();
    viem = connection.viem;

    const wallets = await viem.getWalletClients();
    deployer = wallets[0];
    unauthorizedUser = wallets[1];

    zkVerifier = await viem.deployContract("HoneyZKVerifier", [initialVk]);
  });

  describe("Deployment & Configuration", function () {
    it("should deploy with valid verification key", async function () {
      const vkHash = await zkVerifier.read.circuitVerificationKeyHash();
      assert.equal(vkHash, initialVk);
    });

    it("should allow admin to update verification key", async function () {
      const newVk = keccak256(stringToHex("VK_HONEY_QUALITY_CIRCUIT_V2"));
      await zkVerifier.write.updateVerificationKey([newVk], {
        account: deployer.account.address,
      });

      const updated = await zkVerifier.read.circuitVerificationKeyHash();
      assert.equal(updated, newVk);
    });

    it("should prevent non-admin from updating verification key", async function () {
      const newVk = keccak256(stringToHex("VK_HONEY_MALICIOUS"));
      await assert.rejects(async () => {
        await zkVerifier.write.updateVerificationKey([newVk], {
          account: unauthorizedUser.account.address,
        });
      });
    });
  });

  describe("Proof Verification", function () {
    it("should verify a valid ZK proof for compliant telemetry", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-001",
        timestamp: 1756620000,
        temperature: 34.2,
        humidity: 61.4,
        weight: 22.7,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      const isValid = await zkVerifier.read.verifyProof([
        onchain.proofBytes,
        onchain.publicInputs,
      ]);

      assert.equal(isValid, true);
    });

    it("should reject proof when public inputs count is invalid", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-002",
        timestamp: 1756620000,
        temperature: 35.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      // Truncate public inputs
      const shortInputs = onchain.publicInputs.slice(0, 4);

      const isValid = await zkVerifier.read.verifyProof([
        onchain.proofBytes,
        shortInputs,
      ]);

      assert.equal(isValid, false);
    });

    it("should reject proof when commitment signal is zero", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-003",
        timestamp: 1756620000,
        temperature: 35.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      const zeroCommitmentInputs = [...onchain.publicInputs];
      zeroCommitmentInputs[0] = 0n;

      const isValid = await zkVerifier.read.verifyProof([
        onchain.proofBytes,
        zeroCommitmentInputs,
      ]);

      assert.equal(isValid, false);
    });

    it("should reject proof when temperature bounds are inconsistent", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-004",
        timestamp: 1756620000,
        temperature: 35.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      // Invert minTemp > maxTemp
      const invertedInputs = [...onchain.publicInputs];
      invertedInputs[1] = 4000n; // minTemp = 40°C
      invertedInputs[2] = 3000n; // maxTemp = 30°C

      const isValid = await zkVerifier.read.verifyProof([
        onchain.proofBytes,
        invertedInputs,
      ]);

      assert.equal(isValid, false);
    });

    it("should reject empty/tampered proof payload", async function () {
      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-005",
        timestamp: 1756620000,
        temperature: 35.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      // Malformed 0x00... leading proof bytes
      const zeroProof = "0x00000000000000000000000000000000000000000000000000000000000000001234";

      const isValid = await zkVerifier.read.verifyProof([
        zeroProof,
        onchain.publicInputs,
      ]);

      assert.equal(isValid, false);
    });

    it("should return false when verification is administratively disabled", async function () {
      await zkVerifier.write.setVerificationEnabled([false], {
        account: deployer.account.address,
      });

      const telemetry: TelemetryReading = {
        deviceId: "ESP32-001",
        hiveId: "HIVE-101",
        batchId: "HONEY-TEST-006",
        timestamp: 1756620000,
        temperature: 34.0,
        humidity: 60.0,
        weight: 20.0,
      };

      const proofPayload = await zkService.generateProof(telemetry);
      const onchain = zkService.formatProofForOnchain(proofPayload);

      const isValid = await zkVerifier.read.verifyProof([
        onchain.proofBytes,
        onchain.publicInputs,
      ]);

      assert.equal(isValid, false);
    });
  });
});
