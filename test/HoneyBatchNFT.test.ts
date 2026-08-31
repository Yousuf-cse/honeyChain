import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import hre from "hardhat";
import { keccak256, stringToHex } from "viem";

describe("HoneyBatchNFT", async function () {
  // We intentionally use any here because the contract instance
  // type is generated dynamically by Hardhat/Viem.
  let honeyBatchNFT: any;
  let viem: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    const connection = await hre.network.connect();

    viem = connection.viem;

    const wallets = await viem.getWalletClients();

    owner = wallets[0];
    user = wallets[1];

    honeyBatchNFT = await viem.deployContract(
      "HoneyBatchNFT"
    );
  });

  // ----------------------------------------
  // DEPLOYMENT
  // ----------------------------------------

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      assert.ok(honeyBatchNFT.address);
    });

    it("should give deployer the admin role", async function () {
      const DEFAULT_ADMIN_ROLE =
        await honeyBatchNFT.read.DEFAULT_ADMIN_ROLE();

      const hasRole =
        await honeyBatchNFT.read.hasRole([
          DEFAULT_ADMIN_ROLE,
          owner.account.address,
        ]);

      assert.equal(hasRole, true);
    });

    it("should give deployer the verifier role", async function () {
      const VERIFIER_ROLE =
        await honeyBatchNFT.read.VERIFIER_ROLE();

      const hasRole =
        await honeyBatchNFT.read.hasRole([
          VERIFIER_ROLE,
          owner.account.address,
        ]);

      assert.equal(hasRole, true);
    });

    it("should give deployer the batch minter role", async function () {
      const BATCH_MINTER_ROLE =
        await honeyBatchNFT.read.BATCH_MINTER_ROLE();

      const hasRole =
        await honeyBatchNFT.read.hasRole([
          BATCH_MINTER_ROLE,
          owner.account.address,
        ]);

      assert.equal(hasRole, true);
    });

    it("should give deployer the lab role", async function () {
      const LAB_ROLE =
        await honeyBatchNFT.read.LAB_ROLE();

      const hasRole =
        await honeyBatchNFT.read.hasRole([
          LAB_ROLE,
          owner.account.address,
        ]);

      assert.equal(hasRole, true);
    });
  });

  // ----------------------------------------
  // MINTING
  // ----------------------------------------

  describe("Honey Batch", function () {
    it("should mint a new honey batch", async function () {
      const commitment = keccak256(
        stringToHex("HONEY_DATA_001")
      );

      await honeyBatchNFT.write.mintBatch(
        [
          "HONEY001",
          "HIVE001",
          "BK001",
          "ipfs://metadata",
          commitment,
        ],
        {
          account: owner.account.address,
        }
      );

      const batch =
        await honeyBatchNFT.read.getBatch([1n]);

      assert.equal(batch.batchId, "HONEY001");
      assert.equal(batch.hiveId, "HIVE001");
      assert.equal(batch.beekeeperId, "BK001");
      assert.equal(batch.metadataURI, "ipfs://metadata");
      assert.equal(batch.dataCommitment, commitment);

      // RAW_HARVEST = 0
      assert.equal(Number(batch.state), 0);
    });

    it("should reject duplicate batch IDs", async function () {
      const commitment = keccak256(stringToHex("HONEY_DATA_001"));

      await honeyBatchNFT.write.mintBatch(
        ["HONEY_DUP", "HIVE001", "BK001", "ipfs://meta1", commitment],
        { account: owner.account.address }
      );

      await assert.rejects(async () => {
        await honeyBatchNFT.write.mintBatch(
          ["HONEY_DUP", "HIVE002", "BK002", "ipfs://meta2", commitment],
          { account: owner.account.address }
        );
      });
    });

    it("should support getBatchByBatchId lookup and totalBatches count", async function () {
      const commitment = keccak256(stringToHex("LOOKUP_TEST"));

      await honeyBatchNFT.write.mintBatch(
        ["HONEY_LOOKUP", "HIVE_LOOKUP", "BK_LOOKUP", "ipfs://lookup", commitment],
        { account: owner.account.address }
      );

      const [batch, tokenId] = await honeyBatchNFT.read.getBatchByBatchId(["HONEY_LOOKUP"]);
      assert.equal(batch.batchId, "HONEY_LOOKUP");
      assert.equal(Number(tokenId), 1);

      const total = await honeyBatchNFT.read.totalBatches();
      assert.equal(Number(total), 1);

      const tokenURI = await honeyBatchNFT.read.tokenURI([1n]);
      assert.equal(tokenURI, "ipfs://lookup");
    });
  });

  // ----------------------------------------
  // STATE LIFECYCLE
  // ----------------------------------------

  describe("Batch State Lifecycle", function () {
    beforeEach(async function () {
      const commitment = keccak256(
        stringToHex("HONEY_DATA")
      );

      await honeyBatchNFT.write.mintBatch(
        [
          "HONEY001",
          "HIVE001",
          "BK001",
          "ipfs://metadata",
          commitment,
        ],
        {
          account: owner.account.address,
        }
      );
    });

    it(
      "should move RAW_HARVEST → LAB_VERIFIED",
      async function () {
        await honeyBatchNFT.write.updateState(
          [1n, 1],
          {
            account: owner.account.address,
          }
        );

        const batch =
          await honeyBatchNFT.read.getBatch([1n]);

        // LAB_VERIFIED = 1
        assert.equal(Number(batch.state), 1);
      }
    );

    it(
      "should move LAB_VERIFIED → PACKAGED_RETAIL",
      async function () {
        await honeyBatchNFT.write.updateState(
          [1n, 1],
          {
            account: owner.account.address,
          }
        );

        await honeyBatchNFT.write.updateState(
          [1n, 2],
          {
            account: owner.account.address,
          }
        );

        const batch =
          await honeyBatchNFT.read.getBatch([1n]);

        // PACKAGED_RETAIL = 2
        assert.equal(Number(batch.state), 2);
      }
    );

    it(
      "should reject RAW_HARVEST → PACKAGED_RETAIL",
      async function () {
        await assert.rejects(async () => {
          await honeyBatchNFT.write.updateState(
            [1n, 2],
            {
              account: owner.account.address,
            }
          );
        });
      }
    );

    it(
      "should reject going backwards",
      async function () {
        await honeyBatchNFT.write.updateState(
          [1n, 1],
          {
            account: owner.account.address,
          }
        );

        await assert.rejects(async () => {
          await honeyBatchNFT.write.updateState(
            [1n, 0],
            {
              account: owner.account.address,
            }
          );
        });
      }
    );
  });

  // ----------------------------------------
  // ACCESS CONTROL
  // ----------------------------------------

  describe("Access Control", function () {
    it(
      "should prevent unauthorized users from minting",
      async function () {
        const commitment = keccak256(
          stringToHex("UNAUTHORIZED")
        );

        await assert.rejects(async () => {
          await honeyBatchNFT.write.mintBatch(
            [
              "HONEY003",
              "HIVE003",
              "BK003",
              "ipfs://metadata",
              commitment,
            ],
            {
              account: user.account.address,
            }
          );
        });
      }
    );

    it(
      "should prevent unauthorized users from changing state",
      async function () {
        const commitment = keccak256(
          stringToHex("HONEY_DATA")
        );

        await honeyBatchNFT.write.mintBatch(
          [
            "HONEY001",
            "HIVE001",
            "BK001",
            "ipfs://metadata",
            commitment,
          ],
          {
            account: owner.account.address,
          }
        );

        await assert.rejects(async () => {
          await honeyBatchNFT.write.updateState(
            [1n, 1],
            {
              account: user.account.address,
            }
          );
        });
      }
    );

    it("should allow BATCH_MINTER_ROLE to mint batches", async function () {
      const BATCH_MINTER_ROLE = await honeyBatchNFT.read.BATCH_MINTER_ROLE();

      // Grant minter role to user
      await honeyBatchNFT.write.grantRole(
        [BATCH_MINTER_ROLE, user.account.address],
        { account: owner.account.address }
      );

      const commitment = keccak256(stringToHex("MINTER_TEST"));
      await honeyBatchNFT.write.mintBatch(
        ["HONEY-MINTER", "HIVE-M", "BK-M", "ipfs://minter", commitment],
        { account: user.account.address }
      );

      const batch = await honeyBatchNFT.read.getBatch([1n]);
      assert.equal(batch.batchId, "HONEY-MINTER");
    });

    it("should allow LAB_ROLE to transition to LAB_VERIFIED", async function () {
      const LAB_ROLE = await honeyBatchNFT.read.LAB_ROLE();

      // Grant lab role to user
      await honeyBatchNFT.write.grantRole(
        [LAB_ROLE, user.account.address],
        { account: owner.account.address }
      );

      const commitment = keccak256(stringToHex("LAB_TEST"));
      await honeyBatchNFT.write.mintBatch(
        ["HONEY-LAB", "HIVE-L", "BK-L", "ipfs://lab", commitment],
        { account: owner.account.address }
      );

      // User with LAB_ROLE can verify
      await honeyBatchNFT.write.updateState([1n, 1], {
        account: user.account.address,
      });

      const batch = await honeyBatchNFT.read.getBatch([1n]);
      assert.equal(Number(batch.state), 1); // LAB_VERIFIED
    });

    it("should reject LAB_VERIFIED transition from non-LAB_ROLE user", async function () {
      const commitment = keccak256(stringToHex("NO_LAB"));
      await honeyBatchNFT.write.mintBatch(
        ["HONEY-NOLAB", "HIVE-N", "BK-N", "ipfs://nolab", commitment],
        { account: owner.account.address }
      );

      // user has no LAB_ROLE
      await assert.rejects(async () => {
        await honeyBatchNFT.write.updateState([1n, 1], {
          account: user.account.address,
        });
      });
    });

    it("should reject PACKAGED_RETAIL transition from non-BATCH_MINTER_ROLE user", async function () {
      const commitment = keccak256(stringToHex("NO_MINTER"));
      await honeyBatchNFT.write.mintBatch(
        ["HONEY-NOMINT", "HIVE-NM", "BK-NM", "ipfs://nomint", commitment],
        { account: owner.account.address }
      );

      // Move to LAB_VERIFIED first (owner has admin, so allowed)
      await honeyBatchNFT.write.updateState([1n, 1], {
        account: owner.account.address,
      });

      // Grant LAB_ROLE to user but NOT BATCH_MINTER_ROLE
      const LAB_ROLE = await honeyBatchNFT.read.LAB_ROLE();
      await honeyBatchNFT.write.grantRole(
        [LAB_ROLE, user.account.address],
        { account: owner.account.address }
      );

      // user with LAB_ROLE but not BATCH_MINTER cannot package
      await assert.rejects(async () => {
        await honeyBatchNFT.write.updateState([1n, 2], {
          account: user.account.address,
        });
      });
    });
  });
});