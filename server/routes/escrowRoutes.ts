import { Router, type Request, type Response } from "express";
import { EscrowService } from "../../onchain/services/escrowService.js";
import type { CreateEscrowRequest } from "../../onchain/types/index.js";
import { parseEther } from "viem";

export function createEscrowRouter(escrowService: EscrowService): Router {
  const router = Router();

  /**
   * POST /api/v1/escrow
   * Creates an RWA settlement escrow for a honey batch.
   */
  router.post("/", async (req: Request, res: Response) => {
    const { batchId, tokenId, sellerAddress, arbiterAddress, amountEth, amountWei, releaseTimeoutSeconds } = req.body;

    if (!batchId || !sellerAddress) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: batchId, sellerAddress",
      });
    }

    try {
      const escrowReq: CreateEscrowRequest = {
        batchId: String(batchId).trim(),
        tokenId: tokenId ? String(tokenId) : undefined,
        sellerAddress: sellerAddress.startsWith("0x") ? sellerAddress : `0x${sellerAddress}`,
        arbiterAddress: arbiterAddress
          ? arbiterAddress.startsWith("0x")
            ? arbiterAddress
            : `0x${arbiterAddress}`
          : undefined,
        amountEth: amountEth ? String(amountEth) : undefined,
        amountWei: amountWei ? String(amountWei) : undefined,
        releaseTimeoutSeconds: releaseTimeoutSeconds ? Number(releaseTimeoutSeconds) : undefined,
      };

      const result = await escrowService.createEscrow(escrowReq);

      return res.status(201).json({
        success: true,
        ...result,
        message: "Escrow created successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /api/v1/escrow
   * Lists all trade escrows.
   */
  router.get("/", async (_req: Request, res: Response) => {
    try {
      const escrows = await escrowService.listAllEscrows();
      return res.json({
        success: true,
        count: escrows.length,
        escrows,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * GET /api/v1/escrow/:id
   * Fetches escrow details by escrowId (numeric) or batchId (string).
   */
  router.get("/:id", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);

    try {
      if (/^\d+$/.test(idParam)) {
        const escrow = await escrowService.getEscrow(BigInt(idParam));
        return res.json({
          success: true,
          escrow,
        });
      }

      const escrow = await escrowService.getEscrowByBatchId(idParam);
      if (!escrow) {
        return res.status(404).json({
          success: false,
          error: `Escrow for batch '${idParam}' not found`,
        });
      }

      return res.json({
        success: true,
        escrow,
      });
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * POST /api/v1/escrow/:id/fund
   * Funds an active escrow.
   */
  router.post("/:id/fund", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);
    const { amountEth, amountWei } = req.body;

    if (!amountEth && !amountWei) {
      return res.status(400).json({
        success: false,
        error: "Missing required funding amount (amountEth or amountWei)",
      });
    }

    try {
      const escrowId = BigInt(idParam);
      const wei = amountEth ? parseEther(String(amountEth)) : BigInt(amountWei);

      const result = await escrowService.fundEscrow(escrowId, wei);

      return res.json({
        success: true,
        ...result,
        message: "Escrow funded successfully",
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * POST /api/v1/escrow/:id/release
   * Releases escrow funds to the seller.
   */
  router.post("/:id/release", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);

    try {
      const escrowId = BigInt(idParam);
      const result = await escrowService.releaseEscrow(escrowId);

      return res.json({
        success: true,
        ...result,
        message: "Escrow released successfully to seller",
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  /**
   * POST /api/v1/escrow/:id/refund
   * Refunds escrow funds back to buyer.
   */
  router.post("/:id/refund", async (req: Request, res: Response) => {
    const idParam = String(req.params.id);

    try {
      const escrowId = BigInt(idParam);
      const result = await escrowService.refundEscrow(escrowId);

      return res.json({
        success: true,
        ...result,
        message: "Escrow refunded successfully to buyer",
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
