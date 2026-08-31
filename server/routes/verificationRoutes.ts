import { Router, type Request, type Response } from "express";
import { zkService } from "../../onchain/services/zkService.js";
import type { TelemetryReading, HoneyQualityConstraints, ZKProofPayload } from "../../onchain/types/index.js";

export const verificationRouter = Router();

/**
 * POST /api/v1/verification/prove
 * Requests a ZK-SNARK proof verifying that off-chain telemetry satisfies quality constraints
 * and hashes to the given commitment.
 */
verificationRouter.post("/prove", async (req: Request, res: Response) => {
  const { telemetry, constraints } = req.body as {
    telemetry: TelemetryReading;
    constraints?: Partial<HoneyQualityConstraints>;
  };

  if (!telemetry || !telemetry.batchId || telemetry.temperature === undefined || telemetry.humidity === undefined) {
    return res.status(400).json({
      success: false,
      error: "Missing required telemetry fields for ZK proving",
    });
  }

  try {
    const proofPayload = await zkService.generateProof(telemetry, constraints);
    const onchainParams = zkService.formatProofForOnchain(proofPayload);

    return res.status(200).json({
      success: true,
      batchId: telemetry.batchId,
      zkProof: proofPayload,
      onchainFormatted: {
        proofBytes: onchainParams.proofBytes,
        publicInputsCount: onchainParams.publicInputs.length,
        dataCommitmentHex: "0x" + onchainParams.publicInputs[0].toString(16).padStart(64, "0"),
      },
      message: "ZK proof generated successfully",
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      error: `ZK Prover rejected input: ${(err as Error).message}`,
    });
  }
});

/**
 * POST /api/v1/verification/verify
 * Validates a ZK proof off-chain.
 */
verificationRouter.post("/verify", async (req: Request, res: Response) => {
  const { proofPayload, expectedCommitment } = req.body as {
    proofPayload: ZKProofPayload;
    expectedCommitment?: `0x${string}`;
  };

  if (!proofPayload || !proofPayload.proof || !proofPayload.publicSignals) {
    return res.status(400).json({
      success: false,
      error: "Invalid ZK proof payload supplied for verification",
    });
  }

  try {
    const result = await zkService.verifyProofOffchain(proofPayload, expectedCommitment);
    return res.status(200).json({
      success: result.isValid,
      verificationResult: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  }
});
