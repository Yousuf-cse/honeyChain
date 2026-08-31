// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IZKVerifier
 * @notice Standard interface for Zero-Knowledge SNARK verifiers in HoneyChain.
 * @dev Supports modular replacement with Circom/SnarkJS, Halo2, or Gnark verifiers.
 */
interface IZKVerifier {
    /**
     * @notice Verifies a zk-SNARK proof against public inputs.
     * @param proof The serialized cryptographic proof bytes.
     * @param publicInputs An array of public input signals (commitment, ranges, identifiers).
     * @return isValid True if the proof cryptographically satisfies the circuit constraints.
     */
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external returns (bool isValid);
}
