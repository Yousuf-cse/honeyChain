import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";

export const alertRouter = Router();

// In-memory alert configuration store
interface AlertConfig {
  alertId: string;
  deviceId: string;
  metric: "temperature" | "humidity" | "weightGrams" | "weight";
  condition: "LESS_THAN" | "GREATER_THAN" | "EQUALS";
  threshold: number;
  notifyEmail: boolean;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

const alertStore = new Map<string, AlertConfig>();

/**
 * POST /api/v1/alerts/config
 * Defines sensor threshold alert configuration.
 */
alertRouter.post("/config", requireAuth, (req: Request, res: Response) => {
  const { deviceId, metric, condition, threshold, notifyEmail } = req.body;

  if (!deviceId || !metric || !condition || threshold === undefined) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: deviceId, metric, condition, threshold",
    });
  }

  const validMetrics = ["temperature", "humidity", "weightGrams", "weight"];
  const validConditions = ["LESS_THAN", "GREATER_THAN", "EQUALS"];

  if (!validMetrics.includes(metric)) {
    return res.status(400).json({
      success: false,
      error: `Invalid metric. Must be one of: ${validMetrics.join(", ")}`,
    });
  }

  if (!validConditions.includes(condition)) {
    return res.status(400).json({
      success: false,
      error: `Invalid condition. Must be one of: ${validConditions.join(", ")}`,
    });
  }

  if (typeof threshold !== "number" || isNaN(threshold)) {
    return res.status(400).json({
      success: false,
      error: "Threshold must be a valid number",
    });
  }

  const alertId = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const config: AlertConfig = {
    alertId,
    deviceId: String(deviceId).trim(),
    metric,
    condition,
    threshold: Number(threshold),
    notifyEmail: notifyEmail === true,
    enabled: true,
    createdBy: req.user!.userId,
    createdAt: new Date().toISOString(),
  };

  alertStore.set(alertId, config);

  return res.status(201).json({
    success: true,
    alertId,
    config,
    message: "Alert configuration created successfully",
  });
});

/**
 * GET /api/v1/alerts/config
 * Lists all alert configurations for the authenticated user.
 */
alertRouter.get("/config", requireAuth, (req: Request, res: Response) => {
  const configs = Array.from(alertStore.values()).filter(
    (a) => a.createdBy === req.user!.userId
  );

  return res.json({
    success: true,
    count: configs.length,
    data: configs,
  });
});

/**
 * DELETE /api/v1/alerts/config/:alertId
 * Removes an alert configuration.
 */
alertRouter.delete("/config/:alertId", requireAuth, (req: Request, res: Response) => {
  const alertId = String(req.params.alertId);
  const config = alertStore.get(alertId);

  if (!config) {
    return res.status(404).json({
      success: false,
      error: `Alert configuration '${alertId}' not found`,
    });
  }

  if (config.createdBy !== req.user!.userId) {
    return res.status(403).json({
      success: false,
      error: "Not authorized to delete this alert configuration",
    });
  }

  alertStore.delete(alertId);

  return res.json({
    success: true,
    message: "Alert configuration deleted successfully",
  });
});
