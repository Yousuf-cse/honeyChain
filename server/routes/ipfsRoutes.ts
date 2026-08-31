import { Router, type Request, type Response } from "express";
import { ipfsService } from "../../onchain/services/ipfsService.js";

export const ipfsRouter = Router();

/**
 * POST /api/v1/ipfs/upload
 * Server-side upload endpoint for lab reports, certificates, or images.
 * Accepts base64 encoded document or JSON payload.
 */
ipfsRouter.post("/upload", async (req: Request, res: Response) => {
  const { fileData, fileName, contentType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: fileData (base64 or text), fileName",
    });
  }

  try {
    const buffer = Buffer.from(fileData, fileData.includes(";base64,") ? "base64" : "utf8");
    const result = await ipfsService.uploadDocument(buffer, fileName, contentType);

    return res.status(201).json({
      success: true,
      ...result,
      message: "Document pinned to IPFS successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});

/**
 * POST /api/v1/ipfs/metadata
 * Pins standard HoneyChain ERC-721 metadata JSON to IPFS.
 */
ipfsRouter.post("/metadata", async (req: Request, res: Response) => {
  const {
    batchId,
    hiveId,
    beekeeperId,
    clusterLocation,
    harvestDate,
    floralSource,
    telemetryCommitment,
    nablReport,
    imageUri,
  } = req.body;

  if (!batchId || !hiveId || !beekeeperId || !telemetryCommitment) {
    return res.status(400).json({
      success: false,
      error: "Missing required metadata fields: batchId, hiveId, beekeeperId, telemetryCommitment",
    });
  }

  try {
    const schema = ipfsService.constructMetadataSchema({
      batchId,
      hiveId,
      beekeeperId,
      clusterLocation: clusterLocation || "Nilgiris Cluster",
      harvestDate: harvestDate || new Date().toISOString(),
      floralSource: floralSource || "Multifloral Forest",
      telemetryCommitment,
      nablReport,
      imageUri,
    });

    const result = await ipfsService.uploadJSON(schema);

    return res.status(201).json({
      success: true,
      ...result,
      metadata: schema,
      message: "Metadata pinned to IPFS successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});
