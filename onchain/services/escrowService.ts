import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  getContract,
  parseEther,
  formatEther,
} from "viem";
import { HoneyEscrowAbi } from "../abi/index.js";
import { getContractAddresses } from "../addresses/index.js";
import { createViemClients, type ViemClients } from "../clients/viemClient.js";
import {
  type HoneyEscrowRecord,
  type CreateEscrowRequest,
  type EscrowActionResponse,
  EscrowStatus,
} from "../types/index.js";

export class EscrowService {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private account: Account;
  private contractAddress: Address;

  constructor(options?: {
    clients?: ViemClients;
    contractAddress?: Address;
  }) {
    if (options?.clients) {
      this.publicClient = options.clients.publicClient;
      this.walletClient = options.clients.walletClient;
      this.account = options.clients.account;
    } else {
      const clients = createViemClients();
      this.publicClient = clients.publicClient;
      this.walletClient = clients.walletClient;
      this.account = clients.account;
    }
    this.contractAddress =
      options?.contractAddress || getContractAddresses().honeyEscrow;
  }

  private getContract() {
    return getContract({
      address: this.contractAddress,
      abi: HoneyEscrowAbi,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  /**
   * Creates a new escrow agreement.
   */
  public async createEscrow(req: CreateEscrowRequest): Promise<{
    escrowId: string;
    txHash: Hex;
  }> {
    const contract = this.getContract();

    const tokenIdBigInt = req.tokenId ? BigInt(req.tokenId) : 0n;
    const arbiterAddress = req.arbiterAddress || this.account.address;
    const timeout = BigInt(req.releaseTimeoutSeconds || 7 * 24 * 3600); // 7 days default
    const value = req.amountEth
      ? parseEther(req.amountEth)
      : req.amountWei
      ? BigInt(req.amountWei)
      : 0n;

    const txHash = await contract.write.createEscrow(
      [
        req.batchId,
        tokenIdBigInt,
        req.sellerAddress,
        arbiterAddress,
        timeout,
      ],
      {
        account: this.account,
        value,
        chain: this.walletClient.chain,
      } as any
    );

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Escrow creation failed: ${txHash}`);
    }

    const assignedEscrowId = await contract.read.getEscrowByBatchId([req.batchId]);

    return {
      escrowId: assignedEscrowId.toString(),
      txHash,
    };
  }

  /**
   * Funds an existing escrow agreement.
   */
  public async fundEscrow(
    escrowId: bigint,
    amountWei: bigint
  ): Promise<EscrowActionResponse> {
    const contract = this.getContract();

    const txHash = await contract.write.fundEscrow([escrowId], {
      account: this.account,
      value: amountWei,
      chain: this.walletClient.chain,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Escrow funding failed: ${txHash}`);
    }

    return {
      escrowId: escrowId.toString(),
      status: EscrowStatus.FUNDED,
      txHash,
    };
  }

  /**
   * Releases escrow funds to seller.
   */
  public async releaseEscrow(escrowId: bigint): Promise<EscrowActionResponse> {
    const contract = this.getContract();

    const txHash = await contract.write.releaseEscrow([escrowId], {
      account: this.account,
      chain: this.walletClient.chain,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Escrow release failed: ${txHash}`);
    }

    return {
      escrowId: escrowId.toString(),
      status: EscrowStatus.RELEASED,
      txHash,
    };
  }

  /**
   * Refunds escrow funds to buyer.
   */
  public async refundEscrow(escrowId: bigint): Promise<EscrowActionResponse> {
    const contract = this.getContract();

    const txHash = await contract.write.refundEscrow([escrowId], {
      account: this.account,
      chain: this.walletClient.chain,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Escrow refund failed: ${txHash}`);
    }

    return {
      escrowId: escrowId.toString(),
      status: EscrowStatus.REFUNDED,
      txHash,
    };
  }

  /**
   * Fetches escrow details by escrow ID.
   */
  public async getEscrow(escrowId: bigint): Promise<HoneyEscrowRecord> {
    const contract = this.getContract();
    const data = await contract.read.getEscrow([escrowId]);

    return {
      escrowId: data.escrowId.toString(),
      batchId: data.batchId,
      tokenId: data.tokenId.toString(),
      buyer: data.buyer,
      seller: data.seller,
      arbiter: data.arbiter,
      amount: data.amount.toString(),
      amountEth: formatEther(data.amount),
      status: data.status as EscrowStatus,
      createdAt: Number(data.createdAt),
      releaseTimeout: Number(data.releaseTimeout),
    };
  }

  /**
   * Fetches escrow record by batch ID.
   */
  public async getEscrowByBatchId(batchId: string): Promise<HoneyEscrowRecord | null> {
    const contract = this.getContract();
    try {
      const escrowId = await contract.read.getEscrowByBatchId([batchId]);
      return await this.getEscrow(escrowId);
    } catch {
      return null;
    }
  }

  /**
   * Lists all escrows.
   */
  public async listAllEscrows(): Promise<HoneyEscrowRecord[]> {
    const contract = this.getContract();
    const totalBig = await contract.read.totalEscrows();
    const total = Number(totalBig);
    const results: HoneyEscrowRecord[] = [];

    for (let i = 1; i <= total; i++) {
      try {
        const record = await this.getEscrow(BigInt(i));
        results.push(record);
      } catch {
        // Skip
      }
    }

    return results;
  }
}
