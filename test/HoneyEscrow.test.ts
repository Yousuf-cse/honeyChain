import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import hre from "hardhat";
import { parseEther } from "viem";

describe("HoneyEscrow", async function () {
  let honeyEscrow: any;
  let viem: any;
  let networkHelpers: any;
  let deployer: any;
  let buyer: any;
  let seller: any;
  let arbiter: any;
  let stranger: any;

  beforeEach(async function () {
    const connection = await hre.network.connect();
    viem = connection.viem;
    networkHelpers = connection.networkHelpers;

    const wallets = await viem.getWalletClients();
    deployer = wallets[0];
    buyer = wallets[1];
    seller = wallets[2];
    arbiter = wallets[3];
    stranger = wallets[4];

    honeyEscrow = await viem.deployContract("HoneyEscrow");
  });

  describe("Deployment & Roles", function () {
    it("should deploy successfully", async function () {
      assert.ok(honeyEscrow.address);
    });

    it("should grant deployer default admin and escrow agent roles", async function () {
      const adminRole = await honeyEscrow.read.DEFAULT_ADMIN_ROLE();
      const agentRole = await honeyEscrow.read.ESCROW_AGENT_ROLE();

      const isAdmin = await honeyEscrow.read.hasRole([adminRole, deployer.account.address]);
      const isAgent = await honeyEscrow.read.hasRole([agentRole, deployer.account.address]);

      assert.equal(isAdmin, true);
      assert.equal(isAgent, true);
    });
  });

  describe("Escrow Creation & Funding", function () {
    it("should create an unfunded escrow", async function () {
      await honeyEscrow.write.createEscrow(
        ["BATCH-001", 1n, seller.account.address, arbiter.account.address, 3600n],
        { account: buyer.account.address }
      );

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(escrow.batchId, "BATCH-001");
      assert.equal(escrow.buyer.toLowerCase(), buyer.account.address.toLowerCase());
      assert.equal(escrow.seller.toLowerCase(), seller.account.address.toLowerCase());
      assert.equal(escrow.arbiter.toLowerCase(), arbiter.account.address.toLowerCase());
      assert.equal(escrow.amount, 0n);
      assert.equal(Number(escrow.status), 0); // CREATED
    });

    it("should create and fund escrow in one step", async function () {
      const deposit = parseEther("1.5");
      await honeyEscrow.write.createEscrow(
        ["BATCH-FUNDED", 2n, seller.account.address, arbiter.account.address, 3600n],
        {
          account: buyer.account.address,
          value: deposit,
        }
      );

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(escrow.amount, deposit);
      assert.equal(Number(escrow.status), 1); // FUNDED
    });

    it("should allow funding an already created escrow", async function () {
      await honeyEscrow.write.createEscrow(
        ["BATCH-DELAYED", 3n, seller.account.address, arbiter.account.address, 3600n],
        { account: buyer.account.address }
      );

      const deposit = parseEther("0.75");
      await honeyEscrow.write.fundEscrow([1n], {
        account: buyer.account.address,
        value: deposit,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(escrow.amount, deposit);
      assert.equal(Number(escrow.status), 1); // FUNDED
    });

    it("should reject duplicate escrow creation for the same batch ID", async function () {
      await honeyEscrow.write.createEscrow(
        ["BATCH-DUP", 1n, seller.account.address, arbiter.account.address, 3600n],
        { account: buyer.account.address }
      );

      await assert.rejects(async () => {
        await honeyEscrow.write.createEscrow(
          ["BATCH-DUP", 2n, seller.account.address, arbiter.account.address, 3600n],
          { account: buyer.account.address }
        );
      });
    });
  });

  describe("Escrow Settlement (Release & Refund)", function () {
    beforeEach(async function () {
      const deposit = parseEther("2.0");
      await honeyEscrow.write.createEscrow(
        ["BATCH-SETTLE", 10n, seller.account.address, arbiter.account.address, 86400n], // 1 day timeout
        {
          account: buyer.account.address,
          value: deposit,
        }
      );
    });

    it("should allow buyer to release funds to seller", async function () {
      await honeyEscrow.write.releaseEscrow([1n], {
        account: buyer.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 2); // RELEASED
      assert.equal(escrow.amount, 0n);
    });

    it("should allow arbiter to release funds to seller", async function () {
      await honeyEscrow.write.releaseEscrow([1n], {
        account: arbiter.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 2); // RELEASED
    });

    it("should reject unauthorized stranger releasing funds", async function () {
      await assert.rejects(async () => {
        await honeyEscrow.write.releaseEscrow([1n], {
          account: stranger.account.address,
        });
      });
    });

    it("should allow arbiter to refund escrow at any time", async function () {
      await honeyEscrow.write.refundEscrow([1n], {
        account: arbiter.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 3); // REFUNDED
      assert.equal(escrow.amount, 0n);
    });

    it("should reject buyer refund before timeout, but allow after timeout", async function () {
      // Attempt refund before timeout -> should reject
      await assert.rejects(async () => {
        await honeyEscrow.write.refundEscrow([1n], {
          account: buyer.account.address,
        });
      });

      // Advance time beyond the 86400s releaseTimeout
      if (networkHelpers?.time) {
        await networkHelpers.time.increase(86401);
      }

      // Now buyer can successfully claim refund
      await honeyEscrow.write.refundEscrow([1n], {
        account: buyer.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 3); // REFUNDED
    });
  });

  describe("Escrow Dispute", function () {
    beforeEach(async function () {
      const deposit = parseEther("1.0");
      await honeyEscrow.write.createEscrow(
        ["BATCH-DISPUTE", 20n, seller.account.address, arbiter.account.address, 86400n],
        {
          account: buyer.account.address,
          value: deposit,
        }
      );
    });

    it("should allow buyer to dispute a funded escrow", async function () {
      await honeyEscrow.write.disputeEscrow([1n], {
        account: buyer.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 4); // DISPUTED
    });

    it("should allow seller to dispute a funded escrow", async function () {
      await honeyEscrow.write.disputeEscrow([1n], {
        account: seller.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 4); // DISPUTED
    });

    it("should allow arbiter to dispute a funded escrow", async function () {
      await honeyEscrow.write.disputeEscrow([1n], {
        account: arbiter.account.address,
      });

      const escrow = await honeyEscrow.read.getEscrow([1n]);
      assert.equal(Number(escrow.status), 4); // DISPUTED
    });

    it("should reject dispute from unauthorized stranger", async function () {
      await assert.rejects(async () => {
        await honeyEscrow.write.disputeEscrow([1n], {
          account: stranger.account.address,
        });
      });
    });

    it("should not allow dispute on non-FUNDED escrow", async function () {
      // Release the escrow first
      await honeyEscrow.write.releaseEscrow([1n], {
        account: buyer.account.address,
      });

      // Now try to dispute - should fail
      await assert.rejects(async () => {
        await honeyEscrow.write.disputeEscrow([1n], {
          account: buyer.account.address,
        });
      });
    });
  });
});
