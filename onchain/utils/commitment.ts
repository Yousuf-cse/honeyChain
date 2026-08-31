import { keccak256, stringToHex, type Hex } from "viem";
import type { TelemetryReading, CanonicalTelemetry, CommitmentResult } from "../types/index.js";

/**
 * Deterministically canonicalizes raw IoT telemetry into a standard representation.
 * 
 * Rules for canonicalization:
 * 1. Numeric floating point values (temperature, humidity, weight) are scaled by 100 and rounded to integers.
 * 2. Field names are ordered strictly in lexicographical order:
 *    [batchId, deviceId, hiveId, humidityScaled, temperatureScaled, timestamp, weightScaled]
 * 3. Whitespace is stripped; standard JSON format with sorted keys is produced.
 * 4. Hashing is performed on UTF-8 bytes of this canonical string using Keccak-256.
 */
export function canonicalizeTelemetry(data: TelemetryReading): string {
  if (!data.batchId || !data.deviceId || !data.hiveId) {
    throw new Error("Missing required identifier fields in telemetry payload (batchId, deviceId, hiveId)");
  }

  if (typeof data.timestamp !== "number" || isNaN(data.timestamp)) {
    throw new Error("Invalid timestamp in telemetry payload");
  }

  // Scale floating point metrics to 2 decimal integer precision
  const scaledObj: CanonicalTelemetry = {
    batchId: String(data.batchId).trim(),
    deviceId: String(data.deviceId).trim(),
    hiveId: String(data.hiveId).trim(),
    humidityScaled: Math.round(Number(data.humidity) * 100),
    temperatureScaled: Math.round(Number(data.temperature) * 100),
    timestamp: Math.floor(Number(data.timestamp)),
    weightScaled: Math.round(Number(data.weight) * 100),
  };

  // Construct deterministic JSON string with strictly sorted keys
  const sortedKeys = Object.keys(scaledObj).sort() as Array<keyof CanonicalTelemetry>;
  const orderedEntries: Record<string, string | number> = {};
  for (const key of sortedKeys) {
    orderedEntries[key] = scaledObj[key];
  }

  return JSON.stringify(orderedEntries);
}

/**
 * Generates the deterministic 32-byte Keccak-256 commitment from telemetry.
 */
export function generateTelemetryCommitment(data: TelemetryReading): CommitmentResult {
  const canonicalString = canonicalizeTelemetry(data);
  const hexEncoded = stringToHex(canonicalString);
  const commitment: Hex = keccak256(hexEncoded);

  return {
    commitment,
    canonicalString,
    telemetry: data,
  };
}

/**
 * Verifies that a given telemetry payload matches an expected commitment.
 */
export function verifyTelemetryCommitment(
  data: TelemetryReading,
  expectedCommitment: Hex
): boolean {
  const { commitment } = generateTelemetryCommitment(data);
  return commitment.toLowerCase() === expectedCommitment.toLowerCase();
}
