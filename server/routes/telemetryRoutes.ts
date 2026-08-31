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

/**
 * GET /api/v1/telemetry/live
 * Returns the most recent telemetry reading for a given device.
 * Query param: deviceId (required)
 */
telemetryRouter.get("/live", (req: Request, res: Response) => {
  const { deviceId } = req.query;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: deviceId",
    });
  }

  const deviceReadings = telemetryStore
    .filter((r) => r.deviceId === String(deviceId))
    .sort((a, b) => b.timestamp - a.timestamp);

  if (deviceReadings.length === 0) {
    return res.status(404).json({
      success: false,
      error: `No telemetry found for device '${deviceId}'`,
    });
  }

  const latest = deviceReadings[0];

  return res.json({
    success: true,
    data: {
      deviceId: latest.deviceId,
      hiveId: latest.hiveId,
      batchId: latest.batchId,
      temperature: latest.temperature,
      humidity: latest.humidity,
      weight: latest.weight,
      timestamp: latest.timestamp,
      recordedAt: new Date(latest.timestamp * 1000).toISOString(),
    },
  });
});

/**
 * GET /api/v1/telemetry/history
 * Retrieves historical telemetry with optional date range filtering.
 * Query params: deviceId (required), limit (optional, default 50, max 1000),
 *               startDate (optional ISO 8601), endDate (optional ISO 8601)
 */
telemetryRouter.get("/history", (req: Request, res: Response) => {
  const { deviceId, limit, startDate, endDate } = req.query;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: deviceId",
    });
  }

  let records = telemetryStore.filter((r) => r.deviceId === String(deviceId));

  if (startDate) {
    const startMs = new Date(String(startDate)).getTime();
    if (!isNaN(startMs)) {
      records = records.filter((r) => r.timestamp * 1000 >= startMs);
    }
  }

  if (endDate) {
    const endMs = new Date(String(endDate)).getTime();
    if (!isNaN(endMs)) {
      records = records.filter((r) => r.timestamp * 1000 <= endMs);
    }
  }

  records.sort((a, b) => b.timestamp - a.timestamp);

  const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 1000);
  const paginated = records.slice(0, maxLimit);

  return res.json({
    success: true,
    deviceId: String(deviceId),
    count: paginated.length,
    totalMatched: records.length,
    data: paginated.map((r, i) => ({
      id: records.length - i,
      temperature: r.temperature,
      humidity: r.humidity,
      weight: r.weight,
      batchId: r.batchId,
      timestamp: r.timestamp,
      recordedAt: new Date(r.timestamp * 1000).toISOString(),
    })),
  });
});

/**
 * GET /api/v1/telemetry/stats
 * Returns aggregated min/max/avg statistics for a device over a time range.
 * Query params: deviceId (required), range (optional: "1h", "24h", "7d", default "24h")
 */
telemetryRouter.get("/stats", (req: Request, res: Response) => {
  const { deviceId, range } = req.query;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "Missing required query parameter: deviceId",
    });
  }

  const rangeStr = String(range || "24h");
  let rangeMs: number;

  switch (rangeStr) {
    case "1h":
      rangeMs = 3600_000;
      break;
    case "24h":
      rangeMs = 86400_000;
      break;
    case "7d":
      rangeMs = 604800_000;
      break;
    default:
      rangeMs = 86400_000;
  }

  const now = Date.now();
  const cutoff = now - rangeMs;

  const records = telemetryStore.filter(
    (r) => r.deviceId === String(deviceId) && r.timestamp * 1000 >= cutoff
  );

  if (records.length === 0) {
    return res.json({
      success: true,
      range: rangeStr,
      data: {
        temperature: { min: 0, max: 0, avg: 0 },
        humidity: { min: 0, max: 0, avg: 0 },
        weight: { min: 0, max: 0, avg: 0 },
      },
      readingsCount: 0,
    });
  }

  const temps = records.map((r) => r.temperature);
  const humids = records.map((r) => r.humidity);
  const weights = records.map((r) => r.weight);

  const stats = {
    temperature: {
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)),
    },
    humidity: {
      min: Math.min(...humids),
      max: Math.max(...humids),
      avg: Number((humids.reduce((a, b) => a + b, 0) / humids.length).toFixed(2)),
    },
    weight: {
      min: Math.min(...weights),
      max: Math.max(...weights),
      avg: Number((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2)),
    },
  };

  return res.json({
    success: true,
    range: rangeStr,
    data: stats,
    readingsCount: records.length,
  });
});
