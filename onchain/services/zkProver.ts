import * as snarkjs from "snarkjs";
import * as path from "path";
import { fileURLToPath } from "url";
import { buildPoseidon } from "circomlibjs";
import { type Hex } from "viem";
import { generateTelemetryCommitment } from "../utils/commitment.js";
import type { TelemetryReading, HoneyQualityConstraints } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ZK_DIR = path.resolve(__dirname, "../../zk");
const WASM_PATH = path.join(ZK_DIR, "artifacts/HoneyQualityCircuit_js/HoneyQualityCircuit.wasm");
const ZKEY_PATH = path.join(ZK_DIR, "setup/circuit_0001.zkey");
const VK_PATH = path.join(ZK_DIR, "setup/verification_key.json");

export interface Groth16Proof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
  protocol: "groth16";
  curve: "bn128";
}

export interface ZKProverResult {
  proof: Groth16Proof;
  publicSignals: string[];
  solidityCalldata: string;
}

/**
 * Poseidon-hash a batch ID string into a BN128 field element.
 * Converts each character to its char code and hashes the array.
 */
async function poseidonHashBatchId(poseidon: any, batchId: string): Promise<bigint> {
  // Convert batchId string to array of field-sized numbers
  const chars = Array.from(batchId).map((c) => BigInt(c.charCodeAt(0)));
  // Pad to multiple of 16 (Poseidon optimal chunk size) - or just hash directly
  // Poseidon can take up to 16 inputs; for longer strings, hash in chunks
  if (chars.length <= 16) {
    const padded = [...chars, ...Array(16 - chars.length).fill(0n)];
    return poseidon.F.toObject(poseidon(padded));
  }
  // For longer strings, reduce: hash chunks of 16
  let acc = 0n;
  for (let i = 0; i < chars.length; i += 16) {
    const chunk = chars.slice(i, i + 16);
    const padded = [...chunk, ...Array(16 - chunk.length).fill(0n)];
    acc = poseidon.F.toObject(poseidon([...padded, acc]));
  }
  return acc;
}

/**
 * Poseidon hash of the 5 circuit inputs (matching the circuit's Poseidon(5)).
 */
async function poseidonCommitment(
  poseidon: any,
  tempScaled: number,
  humScaled: number,
  weightScaled: number,
  timestamp: number,
  batchIdHash: bigint
): Promise<bigint> {
  return poseidon.F.toObject(
    poseidon([
      BigInt(tempScaled),
      BigInt(humScaled),
      BigInt(weightScaled),
      BigInt(timestamp),
      batchIdHash,
    ])
  );
}

/**
 * Real Groth16 ZK Prover using SnarkJS.
 * Generates actual zk-SNARK proofs from the HoneyQualityCircuit.
 */
export class ZKProver {
  private wasmPath: string;
  private zkeyPath: string;
  private vkPath: string;
  private poseidon: any;

  constructor(options?: { wasmPath?: string; zkeyPath?: string; vkPath?: string }) {
    this.wasmPath = options?.wasmPath || WASM_PATH;
    this.zkeyPath = options?.zkeyPath || ZKEY_PATH;
    this.vkPath = options?.vkPath || VK_PATH;
  }

  private async ensurePoseidon() {
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
    }
    return this.poseidon;
  }

  /**
   * Generates a real Groth16 proof for the given telemetry and constraints.
   */
  async prove(
    telemetry: TelemetryReading,
    constraints: Partial<HoneyQualityConstraints> = {}
  ): Promise<ZKProverResult> {
    const config = {
      minTemperature: 30.0,
      maxTemperature: 38.0,
      minHumidity: 45.0,
      maxHumidity: 75.0,
      harvestWindowStart: 1700000000,
      harvestWindowEnd: 1890000000,
      ...constraints,
    };

    const poseidon = await this.ensurePoseidon();

    // Scaled values
    const tempScaled = Math.round(telemetry.temperature * 100);
    const humScaled = Math.round(telemetry.humidity * 100);
    const weightScaled = Math.round(telemetry.weight * 100);

    // Compute Poseidon batch ID hash (fits in BN128 field)
    const batchIdHash = await poseidonHashBatchId(poseidon, telemetry.batchId);

    // Compute Poseidon commitment (matches the circuit's Poseidon(5))
    const commitment = await poseidonCommitment(
      poseidon,
      tempScaled,
      humScaled,
      weightScaled,
      telemetry.timestamp,
      batchIdHash
    );

    // Build circuit inputs
    const circuitInput = {
      temperatureScaled: tempScaled,
      humidityScaled: humScaled,
      weightScaled: weightScaled,
      timestamp: telemetry.timestamp,
      batchIdHash: batchIdHash.toString(),
      dataCommitment: commitment.toString(),
      minTemp: Math.round(config.minTemperature * 100),
      maxTemp: Math.round(config.maxTemperature * 100),
      minHumidity: Math.round(config.minHumidity * 100),
      maxHumidity: Math.round(config.maxHumidity * 100),
      harvestStart: Math.floor(config.harvestWindowStart),
      harvestEnd: Math.floor(config.harvestWindowEnd),
      pubBatchIdHash: batchIdHash.toString(),
    };

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInput,
      this.wasmPath,
      this.zkeyPath
    );

    // Generate Solidity calldata
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

    return {
      proof: proof as Groth16Proof,
      publicSignals,
      solidityCalldata: calldata,
    };
  }

  /**
   * Verifies a proof off-chain using the verification key.
   */
  async verify(proof: Groth16Proof, publicSignals: string[]): Promise<boolean> {
    const vKey = await import(this.vkPath, { with: { type: "json" } }).then((m) => m.default);
    return snarkjs.groth16.verify(vKey, publicSignals, proof);
  }

  /**
   * Converts Groth16 proof to bytes for on-chain submission.
   * Encoding: pi_a (64 bytes) + pi_b (128 bytes) + pi_c (64 bytes) = 256 bytes
   */
  proofToBytes(proof: Groth16Proof): Hex {
    const pad = (s: string) => s.slice(2).padStart(64, "0");
    const piA = pad(proof.pi_a[0]) + pad(proof.pi_a[1]);
    const piB =
      pad(proof.pi_b[0][1]) + pad(proof.pi_b[0][0]) +
      pad(proof.pi_b[1][1]) + pad(proof.pi_b[1][0]);
    const piC = pad(proof.pi_c[0]) + pad(proof.pi_c[1]);
    return `0x${piA}${piB}${piC}` as Hex;
  }
}

export const zkProver = new ZKProver();
