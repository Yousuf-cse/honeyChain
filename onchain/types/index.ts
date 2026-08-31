import type { Address, Hex } from "viem";

// -------------------------------------------------------------
// BATCH TYPES
// -------------------------------------------------------------

export enum BatchState {
  RAW_HARVEST = 0,
  LAB_VERIFIED = 1,
  PACKAGED_RETAIL = 2,
}

export interface HoneyBatch {
  batchId: string;
  hiveId: string;
  beekeeperId: string;
  metadataURI: string;
  dataCommitment: Hex;
  state: BatchState;
  tokenId?: bigint | string;
}

export interface MintBatchRequest {
  batchId: string;
  hiveId: string;
  beekeeperId: string;
  metadataURI: string;
  dataCommitment: Hex;
  idempotencyKey?: string;
}

export interface MintBatchResponse {
  tokenId: string;
  batchId: string;
  txHash: Hex;
  batch: HoneyBatch;
  idempotentReplay?: boolean;
}

export interface UpdateBatchStateRequest {
  newState: BatchState;
  zkProof?: Hex;
  publicInputs?: string[];
}

export interface UpdateBatchStateResponse {
  tokenId: string;
  batchId: string;
  previousState: BatchState;
  newState: BatchState;
  txHash: Hex;
}

// -------------------------------------------------------------
// TELEMETRY & COMMITMENT TYPES
// -------------------------------------------------------------

export interface TelemetryReading {
  deviceId: string;
  hiveId: string;
  batchId: string;
  timestamp: number; // Unix epoch in seconds
  temperature: number; // In Celsius (e.g. 34.2)
  humidity: number; // Percentage (e.g. 61.4)
  weight: number; // In kg (e.g. 22.7)
}

export interface CanonicalTelemetry {
  batchId: string;
  deviceId: string;
  hiveId: string;
  humidityScaled: number; // integer (humidity * 100)
  temperatureScaled: number; // integer (temperature * 100)
  timestamp: number;
  weightScaled: number; // integer (weight * 100)
}

export interface CommitmentResult {
  commitment: Hex;
  canonicalString: string;
  telemetry: TelemetryReading;
}

// -------------------------------------------------------------
// ZK PROOF TYPES
// -------------------------------------------------------------

export interface HoneyQualityConstraints {
  minTemperature: number; // e.g. 30.0 °C
  maxTemperature: number; // e.g. 38.0 °C
  minHumidity: number; // e.g. 45.0 %
  maxHumidity: number; // e.g. 75.0 %
  harvestWindowStart: number; // Unix timestamp
  harvestWindowEnd: number; // Unix timestamp
}

export interface ZKProofPayload {
  proof: Hex;
  publicSignals: string[];
  protocol: "groth16" | "plonk" | "mock-snark";
  circuitName: "HoneyQualityCircuit";
}

export interface ZKVerificationResult {
  isValid: boolean;
  commitmentMatches: boolean;
  constraintsSatisfied: boolean;
  details?: string;
}

// -------------------------------------------------------------
// ESCROW TYPES
// -------------------------------------------------------------

export enum EscrowStatus {
  CREATED = 0,
  FUNDED = 1,
  RELEASED = 2,
  REFUNDED = 3,
  DISPUTED = 4,
}

export interface HoneyEscrowRecord {
  escrowId: string;
  batchId: string;
  tokenId: string;
  buyer: Address;
  seller: Address;
  arbiter: Address;
  amount: string; // In wei
  amountEth?: string;
  status: EscrowStatus;
  createdAt: number;
  releaseTimeout: number;
}

export interface CreateEscrowRequest {
  batchId: string;
  tokenId?: string;
  sellerAddress: Address;
  arbiterAddress?: Address;
  amountWei?: string;
  amountEth?: string;
  releaseTimeoutSeconds?: number;
}

export interface EscrowActionResponse {
  escrowId: string;
  status: EscrowStatus;
  txHash: Hex;
}

// -------------------------------------------------------------
// IPFS & METADATA TYPES
// -------------------------------------------------------------

export interface NablLabReportMetadata {
  labName: string;
  accreditationNumber: string;
  testDate: string;
  moisturePercentage: number;
  fructoseGlucoseRatio: number;
  sucrosePercentage: number;
  hmfContent: number; // Hydroxymethylfurfural mg/kg
  pollenAnalysis: string;
  adulterationDetected: boolean;
  status: "PASSED" | "FAILED";
  reportDocumentCID?: string;
}

export interface HoneyBatchMetadataSchema {
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number | boolean;
  }>;
  honeyChain: {
    batchId: string;
    hiveId: string;
    beekeeperId: string;
    clusterLocation: string;
    harvestDate: string;
    floralSource: string;
    telemetryCommitment: Hex;
    nablReport?: NablLabReportMetadata;
  };
}

export interface IPFSUploadResponse {
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
  size: number;
}
