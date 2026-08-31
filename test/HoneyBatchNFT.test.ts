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
  });
});