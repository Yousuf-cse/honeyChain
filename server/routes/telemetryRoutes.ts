import { Router, type Request, type Response } from "express";
import { generateTelemetryCommitment } from "../../onchain/utils/commitment.js";
import type { TelemetryReading } from "../../onchain/types/index.js";

export const telemetryRouter = Router();

// In-memory telemetry log storage for raw off-chain readings
const telemetryStore: TelemetryReading[] = [];

/**
 * POST /api/v1/telemetry/commit
 * Receives raw telemetry from IoT middleware/ESP32, normalizes it, and calculates the cryptographic commitment.
 */
telemetryRouter.post("/commit", (req: Request, res: Response) => {
  const { deviceId, hiveId, batchId, timestamp, temperature, humidity, weight } = req.body;

  if (
    !deviceId ||
    !hiveId ||
    !batchId ||
    timestamp === undefined ||
    temperature === undefined ||
    humidity === undefined ||
    weight === undefined
  ) {
    return res.status(400).json({
      success: false,
      error: "Missing required telemetry fields: deviceId, hiveId, batchId, timestamp, temperature, humidity, weight",
    });
  }

  const reading: TelemetryReading = {
    deviceId: String(deviceId),
    hiveId: String(hiveId),
    batchId: String(batchId),
    timestamp: Number(timestamp),
    temperature: Number(temperature),
    humidity: Number(humidity),
    weight: Number(weight),
  };

  try {
    const result = generateTelemetryCommitment(reading);
    telemetryStore.push(reading);

    return res.status(200).json({
      success: true,
      batchId: reading.batchId,
      dataCommitment: result.commitment,
      canonicalRepresentation: result.canonicalString,
      storedOffchain: true,
      message: "Telemetry normalized and commitment generated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * GET /api/v1/telemetry/batch/:batchId
 * Retrieves off-chain stored telemetry for a specific batch.
 */
telemetryRouter.get("/batch/:batchId", (req: Request, res: Response) => {
  const records = telemetryStore.filter((r) => r.batchId === req.params.batchId);
  return res.json({
    success: true,
    batchId: req.params.batchId,
    readingsCount: records.length,
    readings: records,
  });
});
