import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, sepolia, optimismSepolia, baseSepolia, arbitrumSepolia } from "viem/chains";

// Standard local Hardhat default test key (Account #0)
const DEFAULT_DEV_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export function getChainConfig(chainId?: number): Chain {
  switch (chainId) {
    case 11155111:
      return sepolia;
    case 11155420:
      return optimismSepolia;
    case 84532:
      return baseSepolia;
    case 421614:
      return arbitrumSepolia;
    default:
      return hardhat;
  }
}

export interface ViemClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
}

export function createViemClients(options?: {
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  chainId?: number;
}): ViemClients {
  const rpcUrl = options?.rpcUrl || process.env.RPC_URL || "http://127.0.0.1:8545";
  const rawKey = options?.privateKey || (process.env.PRIVATE_KEY as `0x${string}`) || DEFAULT_DEV_KEY;
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const chainId = options?.chainId || (process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 31337);

  const chain = getChainConfig(chainId);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return {
    publicClient,
    walletClient,
    account,
  };
}
