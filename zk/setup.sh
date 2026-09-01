#!/bin/bash
set -euo pipefail

# HoneyChain ZK Trusted Setup Script
# Re-generates all circuit artifacts from scratch.
# Requires: circom, snarkjs, node

ZK_DIR="$(cd "$(dirname "$0")" && pwd)"
CIRCUITS_DIR="$ZK_DIR/circuits"
ARTIFACTS_DIR="$ZK_DIR/artifacts"
SETUP_DIR="$ZK_DIR/setup"
CIRCOMLIB_DIR="${CIRCOMLIB_DIR:-/tmp}"

echo "=== HoneyChain ZK Setup ==="

# 1. Compile circuit
echo "[1/5] Compiling circuit..."
rm -rf "$ARTIFACTS_DIR"
circom "$CIRCUITS_DIR/HoneyQualityCircuit.circom" \
  --r1cs --wasm --sym \
  -o "$ARTIFACTS_DIR" \
  -l "$CIRCOMLIB_DIR"
echo "  Circuit compiled: 8 public, 5 private inputs"

# 2. Powers of Tau (Phase 1)
echo "[2/5] Generating powers of tau (BN128, 2^12)..."
rm -f "$SETUP_DIR"/pot12_*.ptau
npx snarkjs powersoftau new bn128 12 "$SETUP_DIR/pot12_0000.ptau" -q
echo "171207" | npx snarkjs powersoftau contribute \
  "$SETUP_DIR/pot12_0000.ptau" "$SETUP_DIR/pot12_0001.ptau" \
  --name="HoneyChain" -e="honeychain genesis" -q
npx snarkjs powersoftau prepare phase2 \
  "$SETUP_DIR/pot12_0001.ptau" "$SETUP_DIR/pot12_final.ptau" -q

# 3. Circuit-specific setup (Phase 2)
echo "[3/5] Running circuit-specific Groth16 setup..."
rm -f "$SETUP_DIR"/circuit_*.zkey
npx snarkjs groth16 setup \
  "$ARTIFACTS_DIR/HoneyQualityCircuit.r1cs" \
  "$SETUP_DIR/pot12_final.ptau" \
  "$SETUP_DIR/circuit_0000.zkey" -q
echo "171207" | npx snarkjs zkey contribute \
  "$SETUP_DIR/circuit_0000.zkey" "$SETUP_DIR/circuit_0001.zkey" \
  --name="HoneyChain" -e="circuit contribution" -q

# 4. Export verification key
echo "[4/5] Exporting verification key..."
npx snarkjs zkey export verificationkey \
  "$SETUP_DIR/circuit_0001.zkey" "$SETUP_DIR/verification_key.json" -q

# 5. Generate Solidity verifier
echo "[5/5] Generating Solidity Groth16 verifier..."
npx snarkjs zkey export solidityverifier \
  "$SETUP_DIR/circuit_0001.zkey" "$ZK_DIR/../contracts/HoneyGroth16Verifier.sol" -q

echo ""
echo "=== Setup Complete ==="
echo "Artifacts: $ARTIFACTS_DIR"
echo "Setup:     $SETUP_DIR"
echo "Verifier:  contracts/HoneyGroth16Verifier.sol"
