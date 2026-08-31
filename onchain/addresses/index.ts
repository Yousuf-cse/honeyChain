import type { Address } from "viem";

export interface ContractAddresses {
  honeyBatchNFT: Address;
  honeyEscrow: Address;
  honeyZKVerifier: Address;
}

export const DEFAULT_LOCAL_ADDRESSES: ContractAddresses = {
  honeyBatchNFT: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  honeyEscrow: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  honeyZKVerifier: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

/**
 * Returns current active contract addresses based on environment variables or defaults.
 */
export function getContractAddresses(): ContractAddresses {
  return {
    honeyBatchNFT:
      (process.env.HONEY_BATCH_NFT_ADDRESS as Address) ||
      DEFAULT_LOCAL_ADDRESSES.honeyBatchNFT,
    honeyEscrow:
      (process.env.HONEY_ESCROW_ADDRESS as Address) ||
      DEFAULT_LOCAL_ADDRESSES.honeyEscrow,
    honeyZKVerifier:
      (process.env.ZK_VERIFIER_ADDRESS as Address) ||
      DEFAULT_LOCAL_ADDRESSES.honeyZKVerifier,
  };
}
