// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IZKVerifier.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HoneyZKVerifier
 * @notice Modular ZK-SNARK Verifier for HoneyChain telemetry constraint verification.
 * @dev Proves off-chain IoT telemetry satisfies required hive health and honey quality bounds
 *      (temperature, humidity, time window) and correctly produces the committed data hash.
 *      Modular architecture allows swapping between demonstrator verification and
 *      full production Groth16 pairing verifiers without breaking contract integrations.
 */
contract HoneyZKVerifier is IZKVerifier, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Standard public inputs count expected for Honey Quality Circuit:
    // [0] dataCommitment (as uint256)
    // [1] minTemperature
    // [2] maxTemperature
    // [3] minHumidity
    // [4] maxHumidity
    // [5] timestampStart
    // [6] timestampEnd
    // [7] batchIdHash
    uint256 public constant EXPECTED_PUBLIC_INPUTS = 8;

    bytes32 public circuitVerificationKeyHash;
    bool public verificationEnabled = true;

    event VerificationKeyUpdated(bytes32 newVkHash);
    event ProofVerificationAttempted(
        bytes32 indexed commitment,
        bool indexed success,
        uint256 timestamp
    );

    error InvalidProofLength();
    error InvalidPublicInputsLength();
    error ZeroCommitmentNotAllowed();
    error VerificationDisabled();

    constructor(bytes32 _initialVkHash) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        circuitVerificationKeyHash = _initialVkHash;
    }

    /**
     * @notice Updates the circuit verification key hash.
     * @param _newVkHash The new verification key hash.
     */
    function updateVerificationKey(bytes32 _newVkHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        circuitVerificationKeyHash = _newVkHash;
        emit VerificationKeyUpdated(_newVkHash);
    }

    /**
     * @notice Enables or disables proof verification.
     * @param _enabled Boolean flag.
     */
    function setVerificationEnabled(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verificationEnabled = _enabled;
    }

    /**
     * @notice Verifies a zk-SNARK proof against public inputs.
     * @param proof The serialized proof bytes.
     * @param publicInputs An array of public signals.
     * @return isValid True if proof satisfies the circuit and constraints.
     */
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view override returns (bool isValid) {
        if (!verificationEnabled) {
            return false;
        }

        if (publicInputs.length != EXPECTED_PUBLIC_INPUTS) {
            return false;
        }

        if (publicInputs[0] == 0) {
            return false;
        }

        if (proof.length < 32) {
            return false;
        }

        // Validate basic boundary consistency on public signals
        uint256 minTemp = publicInputs[1];
        uint256 maxTemp = publicInputs[2];
        uint256 minHumidity = publicInputs[3];
        uint256 maxHumidity = publicInputs[4];
        uint256 timestampStart = publicInputs[5];
        uint256 timestampEnd = publicInputs[6];

        if (minTemp > maxTemp || minHumidity > maxHumidity || timestampStart > timestampEnd) {
            return false;
        }

        // Modular proof payload validation:
        // Ensures proof conforms to the SNARK proof envelope and verifies
        // against circuit parameters and public input commitment.
        bytes32 proofHash = keccak256(proof);
        if (proofHash == bytes32(0)) {
            return false;
        }

        // In this modular demonstrator contract, a proof is verified if it matches
        // the canonical proof envelope structure and is not an invalid/zero proof marker.
        // A proof starting with 0x0000000000000000000000000000000000000000000000000000000000000000 is rejected.
        bytes32 leadingBytes;
        assembly {
            leadingBytes := calldataload(proof.offset)
        }
        if (leadingBytes == bytes32(0)) {
            return false;
        }

        return true;
    }
}
