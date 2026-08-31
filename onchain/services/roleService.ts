import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  getContract,
  keccak256,
  stringToHex,
} from "viem";
import { HoneyBatchNFTAbi } from "../abi/index.js";
import { getContractAddresses } from "../addresses/index.js";
import { createViemClients, type ViemClients } from "../clients/viemClient.js";

export const ROLES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
  VERIFIER_ROLE: keccak256(stringToHex("VERIFIER_ROLE")),
  BATCH_MINTER_ROLE: keccak256(stringToHex("BATCH_MINTER_ROLE")),
  LAB_ROLE: keccak256(stringToHex("LAB_ROLE")),
};

export class RoleService {
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
   * Checks if an account possesses a specific role.
   */
  public async hasRole(role: Hex, account: Address): Promise<boolean> {
    const contract = this.getContract();
    return await contract.read.hasRole([role, account]);
  }

  /**
   * Grants a role to an account (requires DEFAULT_ADMIN_ROLE).
   */
  public async grantRole(role: Hex, account: Address): Promise<Hex> {
    const contract = this.getContract();
    const txHash = await contract.write.grantRole([role, account], {
      account: this.account,
      chain: this.walletClient.chain,
    } as any);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /**
   * Revokes a role from an account (requires DEFAULT_ADMIN_ROLE).
   */
  public async revokeRole(role: Hex, account: Address): Promise<Hex> {
    const contract = this.getContract();
    const txHash = await contract.write.revokeRole([role, account], {
      account: this.account,
      chain: this.walletClient.chain,
    } as any);
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /**
   * Checks all HoneyChain roles for a given account.
   */
  public async checkAccountRoles(account: Address): Promise<{
    isAdmin: boolean;
    isVerifier: boolean;
    isMinter: boolean;
    isLab: boolean;
  }> {
    const [isAdmin, isVerifier, isMinter, isLab] = await Promise.all([
      this.hasRole(ROLES.DEFAULT_ADMIN_ROLE, account),
      this.hasRole(ROLES.VERIFIER_ROLE, account),
      this.hasRole(ROLES.BATCH_MINTER_ROLE, account),
      this.hasRole(ROLES.LAB_ROLE, account),
    ]);

    return { isAdmin, isVerifier, isMinter, isLab };
  }
}
