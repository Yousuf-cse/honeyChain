import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { deviceRouter } from "./routes/deviceRoutes.js";
import { telemetryRouter } from "./routes/telemetryRoutes.js";
import { verificationRouter } from "./routes/verificationRoutes.js";
import { createBatchRouter } from "./routes/batchRoutes.js";
import { ipfsRouter } from "./routes/ipfsRoutes.js";
import { createEscrowRouter } from "./routes/escrowRoutes.js";
import { BatchService } from "../onchain/services/batchService.js";
import { EscrowService } from "../onchain/services/escrowService.js";
import { getContractAddresses } from "../onchain/addresses/index.js";

// Global BigInt JSON serialization support
if (typeof (BigInt.prototype as any).toJSON === "undefined") {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export function createApp(options?: {
  batchService?: BatchService;
  escrowService?: EscrowService;
}): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  const batchService = options?.batchService || new BatchService();
  const escrowService = options?.escrowService || new EscrowService();

  // Health and status endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "HEALTHY",
      service: "HoneyChain Web3 Middleware",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      contracts: getContractAddresses(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Mount API v1 Routers
  app.use("/api/v1/devices", deviceRouter);
  app.use("/api/v1/telemetry", telemetryRouter);
  app.use("/api/v1/verification", verificationRouter);
  app.use("/api/v1/batches", createBatchRouter(batchService));
  app.use("/api/v1/ipfs", ipfsRouter);
  app.use("/api/v1/escrow", createEscrowRouter(escrowService));

  // 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: "Endpoint not found",
    });
  });

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[HoneyChain API Error]", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  });

  return app;
}
