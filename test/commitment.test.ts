import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalizeTelemetry,
  generateTelemetryCommitment,
  verifyTelemetryCommitment,
} from "../onchain/utils/commitment.js";
import type { TelemetryReading } from "../onchain/types/index.js";

describe("Commitment Service (Deterministic Canonicalization)", function () {
  const sampleTelemetry: TelemetryReading = {
    deviceId: "ESP32-HIVE-001",
    hiveId: "HIVE-101",
    batchId: "HONEY-2026-001",
    timestamp: 1756620000,
    temperature: 34.25,
    humidity: 61.4,
    weight: 22.7,
  };

  it("should canonicalize fields in strict sorted lexicographical order", function () {
    const canonical = canonicalizeTelemetry(sampleTelemetry);
    const parsed = JSON.parse(canonical);
    const keys = Object.keys(parsed);

    assert.deepEqual(keys, [
      "batchId",
      "deviceId",
      "hiveId",
      "humidityScaled",
      "temperatureScaled",
      "timestamp",
      "weightScaled",
    ]);

    // Check fixed-point integer scaling (x100)
    assert.equal(parsed.temperatureScaled, 3425);
    assert.equal(parsed.humidityScaled, 6140);
    assert.equal(parsed.weightScaled, 2270);
    assert.equal(parsed.timestamp, 1756620000);
  });

  it("should produce a deterministic 32-byte Keccak-256 commitment", function () {
    const { commitment: comm1 } = generateTelemetryCommitment(sampleTelemetry);
    const { commitment: comm2 } = generateTelemetryCommitment(sampleTelemetry);

    assert.equal(comm1, comm2);
    assert.match(comm1, /^0x[a-fA-F0-9]{64}$/);
  });

  it("should produce distinct commitments when telemetry metrics change", function () {
    const { commitment: baseComm } = generateTelemetryCommitment(sampleTelemetry);

    const tempChanged: TelemetryReading = { ...sampleTelemetry, temperature: 34.5 };
    const { commitment: tempComm } = generateTelemetryCommitment(tempChanged);
    assert.notEqual(baseComm, tempComm);

    const timeChanged: TelemetryReading = { ...sampleTelemetry, timestamp: 1756620001 };
    const { commitment: timeComm } = generateTelemetryCommitment(timeChanged);
    assert.notEqual(baseComm, timeComm);
  });

  it("should verify matching commitments accurately", function () {
    const { commitment } = generateTelemetryCommitment(sampleTelemetry);
    assert.equal(verifyTelemetryCommitment(sampleTelemetry, commitment), true);

    const altered: TelemetryReading = { ...sampleTelemetry, humidity: 62.0 };
    assert.equal(verifyTelemetryCommitment(altered, commitment), false);
  });

  it("should reject telemetry missing required fields", function () {
    assert.throws(() => {
      canonicalizeTelemetry({
        ...sampleTelemetry,
        batchId: "",
      });
    }, /Missing required identifier fields/);
  });
});
