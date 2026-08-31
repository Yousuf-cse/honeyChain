pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract HoneyBatchNFT is ERC721, AccessControl {

    bytes32 public constant VERIFIER_ROLE =
        keccak256("VERIFIER_ROLE");

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

    event BatchMinted(
        uint256 indexed tokenId,
        string batchId
    );

    event BatchStateChanged(
        uint256 indexed tokenId,
        BatchState newState
    );

    constructor()
        ERC721("HoneyChain Batch", "HONEY")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

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

        emit BatchMinted(tokenId, batchId);

        return tokenId;
    }

    function updateState(
        uint256 tokenId,
        BatchState newState
    )
        external
        onlyRole(VERIFIER_ROLE)
    {
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
    }

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

    function getBatch(uint256 tokenId)
        external
        view
        returns (Batch memory)
    {
        return batches[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}