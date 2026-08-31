import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  getContract,
} from "viem";
import { HoneyBatchNFTAbi } from "../abi/index.js";
import { getContractAddresses } from "../addresses/index.js";
import { createViemClients, type ViemClients } from "../clients/viemClient.js";
import {
  type HoneyBatch,
  type MintBatchRequest,
  type MintBatchResponse,
  BatchState,
} from "../types/index.js";

export class BatchService {
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
      options?.contractAddress || getContractAddresses().honeyBatchNFT;
  }

  private getContract() {
    return getContract({
      address: this.contractAddress,
      abi: HoneyBatchNFTAbi,
      client: {
        public: this.publicClient,
        wallet: this.walletClient,
      },
    });
  }

  /**
   * Mints a new batch NFT. Built-in idempotency: If batchId already exists, returns existing record.
   */
  public async mintBatch(req: MintBatchRequest): Promise<MintBatchResponse> {
    const contract = this.getContract();

    // 1. Check idempotency on-chain
    try {
      const existingTokenId = await contract.read.batchIdToTokenId([req.batchId]);
      if (existingTokenId && existingTokenId > 0n) {
        const batchData = await contract.read.getBatch([existingTokenId]);
        return {
          tokenId: existingTokenId.toString(),
          batchId: req.batchId,
          txHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
          batch: {
            batchId: batchData.batchId,
            hiveId: batchData.hiveId,
            beekeeperId: batchData.beekeeperId,
            metadataURI: batchData.metadataURI,
            dataCommitment: batchData.dataCommitment,
            state: batchData.state as BatchState,
            tokenId: existingTokenId.toString(),
          },
          idempotentReplay: true,
        };
      }
    } catch {
      // Proceed to mint
    }

    // 2. Execute mint transaction
    const txHash = await contract.write.mintBatch(
      [
        req.batchId,
        req.hiveId,
        req.beekeeperId,
        req.metadataURI,
        req.dataCommitment,
      ],
      { account: this.account, chain: this.walletClient.chain } as any
    );

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Batch minting transaction failed: ${txHash}`);
    }

    // 3. Read newly assigned token ID
    const assignedTokenId = await contract.read.batchIdToTokenId([req.batchId]);
    const batchData = await contract.read.getBatch([assignedTokenId]);

    return {
      tokenId: assignedTokenId.toString(),
      batchId: req.batchId,
      txHash,
      batch: {
        batchId: batchData.batchId,
        hiveId: batchData.hiveId,
        beekeeperId: batchData.beekeeperId,
        metadataURI: batchData.metadataURI,
        dataCommitment: batchData.dataCommitment,
        state: batchData.state as BatchState,
        tokenId: assignedTokenId.toString(),
      },
      idempotentReplay: false,
    };
  }

  /**
   * Transitions batch state (RAW_HARVEST -> LAB_VERIFIED -> PACKAGED_RETAIL).
   */
  public async updateBatchState(
    tokenId: bigint,
    newState: BatchState
  ): Promise<{ txHash: Hex; newState: BatchState }> {
    const contract = this.getContract();

    const txHash = await contract.write.updateState(
      [tokenId, newState],
      { account: this.account, chain: this.walletClient.chain } as any
    );

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`Batch state update failed: ${txHash}`);
    }

    return { txHash, newState };
  }

  /**
   * Fetches batch record by token ID.
   */
  public async getBatch(tokenId: bigint): Promise<HoneyBatch> {
    const contract = this.getContract();
    const batchData = await contract.read.getBatch([tokenId]);
    return {
      batchId: batchData.batchId,
      hiveId: batchData.hiveId,
      beekeeperId: batchData.beekeeperId,
      metadataURI: batchData.metadataURI,
      dataCommitment: batchData.dataCommitment,
      state: batchData.state as BatchState,
      tokenId: tokenId.toString(),
    };
  }

  /**
   * Fetches batch record and token ID by batch identifier string.
   */
  public async getBatchByBatchId(batchId: string): Promise<HoneyBatch | null> {
    const contract = this.getContract();
    try {
      const res = await contract.read.getBatchByBatchId([batchId]);
      const batchData = res[0];
      const tokenId = res[1];
      return {
        batchId: batchData.batchId,
        hiveId: batchData.hiveId,
        beekeeperId: batchData.beekeeperId,
        metadataURI: batchData.metadataURI,
        dataCommitment: batchData.dataCommitment,
        state: batchData.state as BatchState,
        tokenId: tokenId.toString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Lists all minted batches.
   */
  public async listAllBatches(): Promise<HoneyBatch[]> {
    const contract = this.getContract();
    const totalBig = await contract.read.totalBatches();
    const total = Number(totalBig);
    const results: HoneyBatch[] = [];

    for (let i = 1; i <= total; i++) {
      try {
        const batch = await this.getBatch(BigInt(i));
        results.push(batch);
      } catch {
        // Continue on deleted/missing
      }
    }

    return results;
  }
}
