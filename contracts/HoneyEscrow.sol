// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HoneyEscrow
 * @notice Real-World Asset (RWA) trade settlement escrow for rural beekeeping batches.
 * @dev Manages conditional payment escrow between honey buyers, cooperatives, and beekeepers.
 *      Funds are safely locked in the contract and released upon verified lab certification
 *      or authorized buyer/arbiter settlement.
 */
contract HoneyEscrow is AccessControl, ReentrancyGuard {

    bytes32 public constant ESCROW_AGENT_ROLE = keccak256("ESCROW_AGENT_ROLE");

    enum EscrowStatus {
        CREATED,
        FUNDED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }

    struct Escrow {
        uint256 escrowId;
        string batchId;
        uint256 tokenId;
        address buyer;
        address payable seller;
        address arbiter;
        uint256 amount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 releaseTimeout;
    }

    uint256 private nextEscrowId = 1;

    mapping(uint256 => Escrow) public escrows;
    mapping(string => uint256) public batchIdToEscrowId;

    event EscrowCreated(
        uint256 indexed escrowId,
        string batchId,
        address indexed buyer,
        address indexed seller,
        uint256 amount
    );

    event EscrowFunded(
        uint256 indexed escrowId,
        address indexed funder,
        uint256 amount
    );

    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amount
    );

    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint256 amount
    );

    event EscrowDisputed(
        uint256 indexed escrowId,
        address indexed disputer
    );

    error EscrowNotFound(uint256 escrowId);
    error InvalidEscrowState(EscrowStatus expected, EscrowStatus current);
    error UnauthorizedCaller(address caller);
    error InvalidAmount();
    error InvalidRecipient();
    error TimeoutNotExpired(uint256 availableAt, uint256 currentTimestamp);
    error EscrowAlreadyExistsForBatch(string batchId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ESCROW_AGENT_ROLE, msg.sender);
    }

    /**
     * @notice Creates a new escrow agreement. Can be funded immediately by sending native ETH.
     * @param batchId The unique batch identifier.
     * @param tokenId Optional corresponding token ID on HoneyBatchNFT.
     * @param seller The beekeeper or cooperative receiving payment.
     * @param arbiter The trusted verification arbiter or platform operator.
     * @param releaseTimeout Duration in seconds after which the buyer may claim refund if unfulfilled.
     * @return escrowId Unique ID of the created escrow.
     */
    function createEscrow(
        string memory batchId,
        uint256 tokenId,
        address payable seller,
        address arbiter,
        uint256 releaseTimeout
    )
        external
        payable
        nonReentrant
        returns (uint256)
    {
        if (seller == address(0)) revert InvalidRecipient();
        if (batchIdToEscrowId[batchId] != 0) revert EscrowAlreadyExistsForBatch(batchId);

        uint256 escrowId = nextEscrowId++;

        EscrowStatus initialStatus = msg.value > 0 ? EscrowStatus.FUNDED : EscrowStatus.CREATED;

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            batchId: batchId,
            tokenId: tokenId,
            buyer: msg.sender,
            seller: seller,
            arbiter: arbiter == address(0) ? msg.sender : arbiter,
            amount: msg.value,
            status: initialStatus,
            createdAt: block.timestamp,
            releaseTimeout: releaseTimeout
        });

        batchIdToEscrowId[batchId] = escrowId;

        emit EscrowCreated(escrowId, batchId, msg.sender, seller, msg.value);

        if (msg.value > 0) {
            emit EscrowFunded(escrowId, msg.sender, msg.value);
        }

        return escrowId;
    }

    /**
     * @notice Funds an existing created escrow.
     * @param escrowId The escrow ID to fund.
     */
    function fundEscrow(uint256 escrowId)
        external
        payable
        nonReentrant
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.CREATED) {
            revert InvalidEscrowState(EscrowStatus.CREATED, escrow.status);
        }
        if (msg.value == 0) revert InvalidAmount();

        escrow.amount += msg.value;
        escrow.status = EscrowStatus.FUNDED;

        emit EscrowFunded(escrowId, msg.sender, msg.value);
    }

    /**
     * @notice Releases escrow funds to the seller.
     * @dev Only callable by the buyer, arbiter, or an authorized ESCROW_AGENT_ROLE.
     * @param escrowId The escrow ID to release.
     */
    function releaseEscrow(uint256 escrowId)
        external
        nonReentrant
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED) {
            revert InvalidEscrowState(EscrowStatus.FUNDED, escrow.status);
        }

        bool isAuthorized = (msg.sender == escrow.buyer) ||
                            (msg.sender == escrow.arbiter) ||
                            hasRole(ESCROW_AGENT_ROLE, msg.sender) ||
                            hasRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (!isAuthorized) revert UnauthorizedCaller(msg.sender);

        uint256 amountToRelease = escrow.amount;
        escrow.status = EscrowStatus.RELEASED;
        escrow.amount = 0;

        emit EscrowReleased(escrowId, escrow.seller, amountToRelease);

        (bool success, ) = escrow.seller.call{value: amountToRelease}("");
        require(success, "ETH transfer to seller failed");
    }

    /**
     * @notice Refunds escrow funds to the buyer.
     * @dev Callable by the arbiter at any time, or by the buyer after `releaseTimeout` has elapsed.
     * @param escrowId The escrow ID to refund.
     */
    function refundEscrow(uint256 escrowId)
        external
        nonReentrant
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED) {
            revert InvalidEscrowState(EscrowStatus.FUNDED, escrow.status);
        }

        bool isArbiterOrAdmin = (msg.sender == escrow.arbiter) ||
                                hasRole(ESCROW_AGENT_ROLE, msg.sender) ||
                                hasRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (msg.sender == escrow.buyer) {
            uint256 expiry = escrow.createdAt + escrow.releaseTimeout;
            if (block.timestamp < expiry) {
                revert TimeoutNotExpired(expiry, block.timestamp);
            }
        } else if (!isArbiterOrAdmin) {
            revert UnauthorizedCaller(msg.sender);
        }

        uint256 amountToRefund = escrow.amount;
        escrow.status = EscrowStatus.REFUNDED;
        escrow.amount = 0;

        emit EscrowRefunded(escrowId, escrow.buyer, amountToRefund);

        (bool success, ) = payable(escrow.buyer).call{value: amountToRefund}("");
        require(success, "ETH transfer to buyer failed");
    }

    /**
     * @notice Raises a dispute on a funded escrow.
     * @dev Callable by buyer, seller, arbiter, or authorized agents.
     *      Disputed funds remain locked until arbiter/admin resolves via release or refund.
     * @param escrowId The escrow ID to dispute.
     */
    function disputeEscrow(uint256 escrowId)
        external
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.escrowId == 0) revert EscrowNotFound(escrowId);
        if (escrow.status != EscrowStatus.FUNDED) {
            revert InvalidEscrowState(EscrowStatus.FUNDED, escrow.status);
        }

        bool isAuthorized = (msg.sender == escrow.buyer) ||
                            (msg.sender == escrow.seller) ||
                            (msg.sender == escrow.arbiter) ||
                            hasRole(ESCROW_AGENT_ROLE, msg.sender) ||
                            hasRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (!isAuthorized) revert UnauthorizedCaller(msg.sender);

        escrow.status = EscrowStatus.DISPUTED;

        emit EscrowDisputed(escrowId, msg.sender);
    }

    /**
     * @notice Fetches escrow details by escrow ID.
     */
    function getEscrow(uint256 escrowId)
        external
        view
        returns (Escrow memory)
    {
        if (escrows[escrowId].escrowId == 0) revert EscrowNotFound(escrowId);
        return escrows[escrowId];
    }

    /**
     * @notice Fetches escrow ID associated with a batch ID.
     */
    function getEscrowByBatchId(string memory batchId)
        external
        view
        returns (uint256)
    {
        uint256 escrowId = batchIdToEscrowId[batchId];
        if (escrowId == 0) revert EscrowNotFound(0);
        return escrowId;
    }

    /**
     * @notice Returns total number of escrows created.
     */
    function totalEscrows() external view returns (uint256) {
        return nextEscrowId - 1;
    }
}
