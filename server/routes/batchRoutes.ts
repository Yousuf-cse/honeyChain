import { Router, type Request, type Response } from "express";
import { BatchService } from "../../onchain/services/batchService.js";
import { BatchState, type MintBatchRequest } from "../../onchain/types/index.js";

export function createBatchRouter(batchService: BatchService): Router {
  const router = Router();

  // In-memory idempotency cache for active requests
  const inFlightIdempotency = new Map<string, any>();

  /**
   * POST /api/v1/batches
   * Mints a new HoneyBatchNFT representing a rural harvest batch.
   * Built-in Idempotency: Retries with the same batchId or idempotencyKey return the existing token.
   */
  router.post("/", async (req: Request, res: Response) => {
    const { batchId, hiveId, beekeeperId, metadataURI, dataCommitment, idempotencyKey } = req.body;

    if (!batchId || !hiveId || !beekeeperId || !metadataURI || !dataCommitment) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: batchId, hiveId, beekeeperId, metadataURI, dataCommitment",
      });
    }

    const key = idempotencyKey || batchId;

    if (inFlightIdempotency.has(key)) {
      const cached = inFlightIdempotency.get(key);
      return res.status(200).json({
        success: true,
        ...cached,
        idempotentReplay: true,
      });
    }

    try {
      const mintReq: MintBatchRequest = {
        batchId: String(batchId).trim(),
        hiveId: String(hiveId).trim(),
        beekeeperId: String(beekeeperId).trim(),
        metadataURI: String(metadataURI).trim(),
        dataCommitment: dataCommitment.startsWith("0x") ? dataCommitment : `0x${dataCommitment}`,
        idempotencyKey: key,
      };

      const result = await batchService.mintBatch(mintReq);

      inFlightIdempotency.set(key, result);

      const status = result.idempotentReplay ? 200 : 201;
      return res.status(status).json({
        success: true,
        ...result,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /api/v1/batches
   * Lists all honey batches on-chain.
   */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const batches = await batchService.listAllBatches();
      return res.json({
        success: true,
        count: batches.length,
        batches,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /api/v1/batches/:id
   * Fetches batch details either by numeric tokenId or string batchId.
   */
  router.get("/:id", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);

    try {
      // Check if numeric tokenId
      if (/^\d+$/.test(idParam)) {
        const tokenId = BigInt(idParam);
        const batch = await batchService.getBatch(tokenId);
        return res.json({
          success: true,
          tokenId: idParam,
          batch,
        });
      }

      // Otherwise query by batchId string
      const batch = await batchService.getBatchByBatchId(idParam);
      if (!batch) {
        return res.status(404).json({
          success: false,
          error: `Batch with ID '${idParam}' not found`,
        });
      }

      return res.json({
        success: true,
        tokenId: batch.tokenId?.toString(),
        batch,
      });
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: `Batch query failed: ${(err as Error).message}`,
      });
    }
  });

  /**
   * PATCH /api/v1/batches/:id/state
   * Updates batch state (RAW_HARVEST -> LAB_VERIFIED -> PACKAGED_RETAIL).
   */
  router.patch("/:id/state", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);
    const { newState } = req.body;

    if (newState === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: newState (0: RAW_HARVEST, 1: LAB_VERIFIED, 2: PACKAGED_RETAIL)",
      });
    }

    try {
      let tokenId: bigint;
      if (/^\d+$/.test(idParam)) {
        tokenId = BigInt(idParam);
      } else {
        const batch = await batchService.getBatchByBatchId(idParam);
        if (!batch || batch.tokenId === undefined) {
          return res.status(404).json({
            success: false,
            error: `Batch with ID '${idParam}' not found`,
          });
        }
        tokenId = BigInt(batch.tokenId.toString());
      }

      const targetState = Number(newState) as BatchState;
      const result = await batchService.updateBatchState(tokenId, targetState);

      return res.json({
        success: true,
        tokenId: tokenId.toString(),
        newState: result.newState,
        txHash: result.txHash,
        message: "Batch state updated successfully on-chain",
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  return router;
}
