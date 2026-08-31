import { Router, type Request, type Response } from "express";

export const deviceRouter = Router();

// In-memory device registry for the middleware demo layer
interface RegisteredDevice {
  deviceId: string;
  hiveId: string;
  clusterLocation: string;
  beekeeperId: string;
  registeredAt: number;
  status: "ACTIVE" | "INACTIVE";
}

const deviceRegistry = new Map<string, RegisteredDevice>();

// Pre-seed some default demo devices
deviceRegistry.set("ESP32-HIVE-001", {
  deviceId: "ESP32-HIVE-001",
  hiveId: "HIVE-001",
  clusterLocation: "Nilgiris Mountain Cluster, Tamil Nadu",
  beekeeperId: "BK-IND-902",
  registeredAt: Date.now() - 30 * 86400000,
  status: "ACTIVE",
});

/**
 * POST /api/v1/devices/register
 * Registers an ESP32 hive monitoring unit with cluster and beekeeper mapping.
 */
deviceRouter.post("/register", (req: Request, res: Response) => {
  const { deviceId, hiveId, clusterLocation, beekeeperId } = req.body;

  if (!deviceId || !hiveId || !clusterLocation || !beekeeperId) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: deviceId, hiveId, clusterLocation, beekeeperId",
    });
  }

  const record: RegisteredDevice = {
    deviceId: String(deviceId).trim(),
    hiveId: String(hiveId).trim(),
    clusterLocation: String(clusterLocation).trim(),
    beekeeperId: String(beekeeperId).trim(),
    registeredAt: Date.now(),
    status: "ACTIVE",
  };

  deviceRegistry.set(record.deviceId, record);

  return res.status(201).json({
    success: true,
    message: "Device registered successfully",
    device: record,
  });
});

/**
 * GET /api/v1/devices/:id
 * Fetches device registration details.
 */
deviceRouter.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const device = deviceRegistry.get(id);
  if (!device) {
    return res.status(404).json({
      success: false,
      error: `Device '${id}' not found in registry`,
    });
  }

  return res.json({
    success: true,
    device,
  });
});

/**
 * DELETE /api/v1/devices/:id
 * Removes a device from the registry.
 */
deviceRouter.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);

  if (!deviceRegistry.has(id)) {
    return res.status(404).json({
      success: false,
      error: `Device '${id}' not found in registry`,
    });
  }

  deviceRegistry.delete(id);

  return res.json({
    success: true,
    message: "Device deleted successfully",
  });
});

/**
 * GET /api/v1/devices
 * Lists all registered devices.
 */
deviceRouter.get("/", (_req: Request, res: Response) => {
  return res.json({
    success: true,
    devices: Array.from(deviceRegistry.values()),
  });
});
