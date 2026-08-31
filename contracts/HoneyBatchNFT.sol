// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title HoneyBatchNFT
 * @notice ERC-721 token representing verified Real-World Asset (RWA) Honey Batches.
 * @dev Manages batch metadata, cryptographic data commitments, and lifecycle state transitions.
 *      High-frequency raw IoT telemetry is kept off-chain; only deterministic commitments
 *      and state milestones are anchored on-chain.
 */
contract HoneyBatchNFT is ERC721, AccessControl {

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant BATCH_MINTER_ROLE = keccak256("BATCH_MINTER_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");

    enum BatchState {
        RAW_HARVEST,
        LAB_VERIFIED,
        PACKAGED_RETAIL
    }

    struct Batch {
        string batchId;
        string hiveId;
        string beekeeperId;
        string metadataURI;
        bytes32 dataCommitment;
        BatchState state;
    }

    uint256 private nextTokenId = 1;

    mapping(uint256 => Batch) public batches;
    mapping(string => uint256) public batchIdToTokenId;

    event BatchMinted(
        uint256 indexed tokenId,
        string batchId
    );

    event BatchStateChanged(
        uint256 indexed tokenId,
        BatchState newState
    );

    event BatchVerified(
        uint256 indexed tokenId,
        bytes32 indexed dataCommitment,
        address indexed verifier
    );

    error BatchAlreadyExists(string batchId);
    error BatchDoesNotExist(uint256 tokenId);
    error InvalidStateTransition(BatchState current, BatchState next);

    constructor()
        ERC721("HoneyChain Batch", "HONEY")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(BATCH_MINTER_ROLE, msg.sender);
        _grantRole(LAB_ROLE, msg.sender);
    }

    /**
     * @notice Mints a new HoneyBatchNFT representing a harvested batch.
     * @param batchId Unique identifier for the batch (e.g. HONEY-2026-001).
     * @param hiveId Identifier for the originating hive.
     * @param beekeeperId Identifier for the cluster beekeeper.
     * @param metadataURI IPFS URI pointing to batch metadata schema.
     * @param dataCommitment Cryptographic commitment of canonical telemetry.
     * @return tokenId The ID of the minted ERC-721 token.
     */
    function mintBatch(
        string memory batchId,
        string memory hiveId,
        string memory beekeeperId,
        string memory metadataURI,
        bytes32 dataCommitment
    )
        external
        onlyRole(VERIFIER_ROLE)
        returns (uint256)
    {
        require(batchIdToTokenId[batchId] == 0, "Batch ID already exists");

        uint256 tokenId = nextTokenId++;

        _safeMint(msg.sender, tokenId);

        batches[tokenId] = Batch({
            batchId: batchId,
            hiveId: hiveId,
            beekeeperId: beekeeperId,
            metadataURI: metadataURI,
            dataCommitment: dataCommitment,
            state: BatchState.RAW_HARVEST
        });

        batchIdToTokenId[batchId] = tokenId;

        emit BatchMinted(tokenId, batchId);

        return tokenId;
    }

    /**
     * @notice Updates the lifecycle state of an existing honey batch.
     * @param tokenId The token ID of the batch.
     * @param newState Target state (LAB_VERIFIED or PACKAGED_RETAIL).
     */
    function updateState(
        uint256 tokenId,
        BatchState newState
    )
        external
        onlyRole(VERIFIER_ROLE)
    {
        require(tokenId > 0 && tokenId < nextTokenId, "Batch does not exist");
        require(
            _isValidTransition(
                batches[tokenId].state,
                newState
            ),
            "Invalid state transition"
        );

        batches[tokenId].state = newState;

        emit BatchStateChanged(
            tokenId,
            newState
        );

        if (newState == BatchState.LAB_VERIFIED) {
            emit BatchVerified(
                tokenId,
                batches[tokenId].dataCommitment,
                msg.sender
            );
        }
    }

    /**
     * @dev Validates allowable state machine transitions.
     *      RAW_HARVEST (0) -> LAB_VERIFIED (1) -> PACKAGED_RETAIL (2)
     */
    function _isValidTransition(
        BatchState current,
        BatchState next
    )
        internal
        pure
        returns (bool)
    {
        return
            (current == BatchState.RAW_HARVEST &&
             next == BatchState.LAB_VERIFIED)
            ||
            (current == BatchState.LAB_VERIFIED &&
             next == BatchState.PACKAGED_RETAIL);
    }

    /**
     * @notice Returns the full batch details for a given token ID.
     * @param tokenId The ERC-721 token ID.
     */
    function getBatch(uint256 tokenId)
        external
        view
        returns (Batch memory)
    {
        require(tokenId > 0 && tokenId < nextTokenId, "Batch does not exist");
        return batches[tokenId];
    }

    /**
     * @notice Returns the batch and token ID by its string batch ID.
     * @param batchId The unique batch identifier.
     */
    function getBatchByBatchId(string memory batchId)
        external
        view
        returns (Batch memory batch, uint256 tokenId)
    {
        tokenId = batchIdToTokenId[batchId];
        require(tokenId != 0, "Batch ID not found");
        batch = batches[tokenId];
    }

    /**
     * @notice Total number of batches minted.
     */
    function totalBatches() external view returns (uint256) {
        return nextTokenId - 1;
    }

    /**
     * @notice Returns the ERC-721 metadata URI for a token.
     * @param tokenId The token ID.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(tokenId > 0 && tokenId < nextTokenId, "Batch does not exist");
        return batches[tokenId].metadataURI;
    }

    /**
     * @dev Supports interface override for ERC721 & AccessControl.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}