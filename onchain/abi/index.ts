export const HoneyBatchNFTAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "DEFAULT_ADMIN_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "VERIFIER_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "BATCH_MINTER_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "LAB_ROLE",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "batches",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "batchId", type: "string", internalType: "string" },
      { name: "hiveId", type: "string", internalType: "string" },
      { name: "beekeeperId", type: "string", internalType: "string" },
      { name: "metadataURI", type: "string", internalType: "string" },
      { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
      { name: "state", type: "uint8", internalType: "enum HoneyBatchNFT.BatchState" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "batchIdToTokenId",
    inputs: [{ name: "", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getBatch",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct HoneyBatchNFT.Batch",
        components: [
          { name: "batchId", type: "string", internalType: "string" },
          { name: "hiveId", type: "string", internalType: "string" },
          { name: "beekeeperId", type: "string", internalType: "string" },
          { name: "metadataURI", type: "string", internalType: "string" },
          { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
          { name: "state", type: "uint8", internalType: "enum HoneyBatchNFT.BatchState" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getBatchByBatchId",
    inputs: [{ name: "batchId", type: "string", internalType: "string" }],
    outputs: [
      {
        name: "batch",
        type: "tuple",
        internalType: "struct HoneyBatchNFT.Batch",
        components: [
          { name: "batchId", type: "string", internalType: "string" },
          { name: "hiveId", type: "string", internalType: "string" },
          { name: "beekeeperId", type: "string", internalType: "string" },
          { name: "metadataURI", type: "string", internalType: "string" },
          { name: "dataCommitment", type: "bytes32", internalType: "bytes32" },
          { name: "state", type: "uint8", internalType: "enum HoneyBatchNFT.BatchState" }
        ]
      },
      { name: "tokenId", type: "uint256", internalType: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "hasRole",
    inputs: [
      { name: "role", type: "bytes32", internalType: "bytes32" },
      { name: "account", type: "address", internalType: "address" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "grantRole",
    inputs: [
      { name: "role", type: "bytes32", internalType: "bytes32" },
      { name: "account", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "revokeRole",
    inputs: [
      { name: "role", type: "bytes32", internalType: "bytes32" },
      { name: "account", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "mintBatch",
    inputs: [
      { name: "batchId", type: "string", internalType: "string" },
      { name: "hiveId", type: "string", internalType: "string" },
      { name: "beekeeperId", type: "string", internalType: "string" },
      { name: "metadataURI", type: "string", internalType: "string" },
      { name: "dataCommitment", type: "bytes32", internalType: "bytes32" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "updateState",
    inputs: [
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "newState", type: "uint8", internalType: "enum HoneyBatchNFT.BatchState" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "totalBatches",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "BatchMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "batchId", type: "string", indexed: false, internalType: "string" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "BatchStateChanged",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "newState", type: "uint8", indexed: false, internalType: "enum HoneyBatchNFT.BatchState" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "BatchVerified",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "dataCommitment", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "verifier", type: "address", indexed: true, internalType: "address" }
    ],
    anonymous: false
  }
] as const;

export const HoneyEscrowAbi = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createEscrow",
    inputs: [
      { name: "batchId", type: "string", internalType: "string" },
      { name: "tokenId", type: "uint256", internalType: "uint256" },
      { name: "seller", type: "address", internalType: "address payable" },
      { name: "arbiter", type: "address", internalType: "address" },
      { name: "releaseTimeout", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "fundEscrow",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "releaseEscrow",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "refundEscrow",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "disputeEscrow",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getEscrow",
    inputs: [{ name: "escrowId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct HoneyEscrow.Escrow",
        components: [
          { name: "escrowId", type: "uint256", internalType: "uint256" },
          { name: "batchId", type: "string", internalType: "string" },
          { name: "tokenId", type: "uint256", internalType: "uint256" },
          { name: "buyer", type: "address", internalType: "address" },
          { name: "seller", type: "address", internalType: "address payable" },
          { name: "arbiter", type: "address", internalType: "address" },
          { name: "amount", type: "uint256", internalType: "uint256" },
          { name: "status", type: "uint8", internalType: "enum HoneyEscrow.EscrowStatus" },
          { name: "createdAt", type: "uint256", internalType: "uint256" },
          { name: "releaseTimeout", type: "uint256", internalType: "uint256" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getEscrowByBatchId",
    inputs: [{ name: "batchId", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "totalEscrows",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "batchId", type: "string", indexed: false, internalType: "string" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EscrowFunded",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "funder", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EscrowReleased",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "seller", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EscrowRefunded",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "buyer", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EscrowDisputed",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "disputer", type: "address", indexed: true, internalType: "address" }
    ],
    anonymous: false
  }
] as const;

export const HoneyZKVerifierAbi = [
  {
    type: "constructor",
    inputs: [{ name: "_initialVkHash", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "verifyProof",
    inputs: [
      { name: "proof", type: "bytes", internalType: "bytes" },
      { name: "publicInputs", type: "uint256[]", internalType: "uint256[]" }
    ],
    outputs: [{ name: "isValid", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "updateVerificationKey",
    inputs: [{ name: "_newVkHash", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setVerificationEnabled",
    inputs: [{ name: "_enabled", type: "bool", internalType: "bool" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "VerificationKeyUpdated",
    inputs: [{ name: "newVkHash", type: "bytes32", indexed: false, internalType: "bytes32" }],
    anonymous: false
  },
  {
    type: "event",
    name: "ProofVerificationAttempted",
    inputs: [
      { name: "commitment", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "success", type: "bool", indexed: true, internalType: "bool" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" }
    ],
    anonymous: false
  }
] as const;
