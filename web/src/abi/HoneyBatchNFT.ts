export const HONEY_BATCH_NFT_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getBatch",
    outputs: [
      {
        components: [
          { name: "batchId", type: "string" },
          { name: "beekeeper", type: "address" },
          { name: "honeyWeightKg", type: "uint256" },
          { name: "harvestTimestamp", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "commitmentHash", type: "bytes32" },
          { name: "zkVerified", type: "bool" },
          { name: "nablReportHash", type: "string" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "batchId", type: "string" }],
    name: "getBatchByBatchId",
    outputs: [
      {
        components: [
          { name: "batchId", type: "string" },
          { name: "beekeeper", type: "address" },
          { name: "honeyWeightKg", type: "uint256" },
          { name: "harvestTimestamp", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "commitmentHash", type: "bytes32" },
          { name: "zkVerified", type: "bool" },
          { name: "nablReportHash", type: "string" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "tokensOfOwner",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const STATE_MAP: Record<number, string> = {
  0: "RAW_HARVEST",
  1: "LAB_VERIFIED",
  2: "PACKAGED_RETAIL",
};
