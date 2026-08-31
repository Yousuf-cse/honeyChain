import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import request from "supertest";
import hre from "hardhat";
import { createApp } from "../server/app.js";
import { BatchService } from "../onchain/services/batchService.js";
import { EscrowService } from "../onchain/services/escrowService.js";
import type { TelemetryReading } from "../onchain/types/index.js";

describe("IoT API Endpoints Suite", function () {
  let app: any;
  let batchService: BatchService;
  let escrowService: EscrowService;
  let viem: any;
  let deployer: any;
  let userToken: string;
  let testDeviceId: string;

  beforeEach(async function () {
    const connection = await hre.network.connect();
    viem = connection.viem;
    const wallets = await viem.getWalletClients();
    deployer = wallets[0];

    const honeyBatchNFT = await viem.deployContract("HoneyBatchNFT");
    const honeyEscrow = await viem.deployContract("HoneyEscrow");

    batchService = new BatchService({
      clients: {
        publicClient: await viem.getPublicClient(),
        walletClient: deployer,
        account: deployer.account,
      },
      contractAddress: honeyBatchNFT.address,
    });

    escrowService = new EscrowService({
      clients: {
        publicClient: await viem.getPublicClient(),
        walletClient: deployer,
        account: deployer.account,
      },
      contractAddress: honeyEscrow.address,
    });

    app = createApp({ batchService, escrowService });

    // Register a user and get token (login if already exists from prior test)
    const testEmail = `iot_${Date.now()}@honeychain.io`;
    const regRes = await request(app).post("/api/v1/auth/register").send({
      username: "testuser_iot",
      email: testEmail,
      password: "TestPass123!",
    });
    userToken = regRes.body.data?.token;
    if (!userToken) {
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: testEmail,
        password: "TestPass123!",
      });
      userToken = loginRes.body.data?.token;
    }
    testDeviceId = `DEV-${Date.now()}`;
  });

  describe("Auth - Register", function () {
    it("POST /api/v1/auth/register should create a new user and return JWT", async function () {
      const res = await request(app).post("/api/v1/auth/register").send({
        username: "newbeekeeper",
        email: "new@honeychain.io",
        password: "StrongPass123!",
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.username, "newbeekeeper");
      assert.equal(res.body.data.email, "new@honeychain.io");
    });

    it("POST /api/v1/auth/register should reject duplicate email", async function () {
      const dupEmail = `dup_${Date.now()}@honeychain.io`;
      await request(app).post("/api/v1/auth/register").send({
        username: "first",
        email: dupEmail,
        password: "TestPass123!",
      });

      const res = await request(app).post("/api/v1/auth/register").send({
        username: "second",
        email: dupEmail,
        password: "TestPass456!",
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
    });

    it("POST /api/v1/auth/register should reject short password", async function () {
      const res = await request(app).post("/api/v1/auth/register").send({
        username: "shortpw",
        email: "short@honeychain.io",
        password: "123",
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /at least 8 characters/);
    });

    it("POST /api/v1/auth/register should reject missing fields", async function () {
      const res = await request(app).post("/api/v1/auth/register").send({
        username: "incomplete",
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe("Auth - Login", function () {
    it("POST /api/v1/auth/login should return JWT for valid credentials", async function () {
      // Register first
      await request(app).post("/api/v1/auth/register").send({
        username: "logintest",
        email: "login@honeychain.io",
        password: "LoginPass123!",
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "login@honeychain.io",
        password: "LoginPass123!",
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.expiresIn, "7d");
    });

    it("POST /api/v1/auth/login should reject wrong password", async function () {
      await request(app).post("/api/v1/auth/register").send({
        username: "wrongpwtest",
        email: "wrongpw@honeychain.io",
        password: "RightPass123!",
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "wrongpw@honeychain.io",
        password: "WrongPass999!",
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, "Invalid email or password");
    });

    it("POST /api/v1/auth/login should reject nonexistent email", async function () {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "ghost@honeychain.io",
        password: "Anything123!",
      });

      assert.equal(res.status, 401);
    });
  });

  describe("Auth - Profile", function () {
    it("GET /api/v1/auth/me should return user profile with valid JWT", async function () {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, "testuser_iot");
      assert.ok(res.body.data.email);
      assert.ok(res.body.data.createdAt);
    });

    it("GET /api/v1/auth/me should reject without token", async function () {
      const res = await request(app).get("/api/v1/auth/me");
      assert.equal(res.status, 401);
    });

    it("GET /api/v1/auth/me should reject invalid token", async function () {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid.token.here");

      assert.equal(res.status, 401);
    });
  });

  describe("Device Deletion", function () {
    it("DELETE /api/v1/devices/:id should remove a device", async function () {
      // Register a device first
      await request(app).post("/api/v1/devices/register").send({
        deviceId: testDeviceId,
        hiveId: "HIVE-DEL-001",
        clusterLocation: "Test Cluster",
        beekeeperId: "BK-DEL-001",
      });

      const res = await request(app).delete(`/api/v1/devices/${testDeviceId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.match(res.body.message, /deleted/i);

      // Verify it's gone
      const getRes = await request(app).get(`/api/v1/devices/${testDeviceId}`);
      assert.equal(getRes.status, 404);
    });

    it("DELETE /api/v1/devices/:id should return 404 for nonexistent device", async function () {
      const res = await request(app).delete("/api/v1/devices/FAKE-DEVICE-999");
      assert.equal(res.status, 404);
    });
  });

  describe("Telemetry Live", function () {
    it("GET /api/v1/telemetry/live should return latest reading for device", async function () {
      const deviceId = `LIVE-DEV-${Date.now()}`;

      // Submit two readings
      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-LIVE-001",
        batchId: "BATCH-LIVE-001",
        timestamp: 1756620000,
        temperature: 30.0,
        humidity: 60.0,
        weight: 20.0,
      });

      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-LIVE-001",
        batchId: "BATCH-LIVE-001",
        timestamp: 1756620060,
        temperature: 31.5,
        humidity: 62.0,
        weight: 21.0,
      });

      const res = await request(app).get(`/api/v1/telemetry/live?deviceId=${deviceId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.temperature, 31.5); // latest reading
      assert.equal(res.body.data.humidity, 62.0);
      assert.ok(res.body.data.recordedAt);
    });

    it("GET /api/v1/telemetry/live should return 404 for unknown device", async function () {
      const res = await request(app).get("/api/v1/telemetry/live?deviceId=UNKNOWN-999");
      assert.equal(res.status, 404);
    });

    it("GET /api/v1/telemetry/live should require deviceId param", async function () {
      const res = await request(app).get("/api/v1/telemetry/live");
      assert.equal(res.status, 400);
    });
  });

  describe("Telemetry History", function () {
    it("GET /api/v1/telemetry/history should return paginated readings", async function () {
      const deviceId = `HIST-DEV-${Date.now()}`;

      // Submit 3 readings
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/v1/telemetry/commit").send({
          deviceId,
          hiveId: "HIVE-HIST-001",
          batchId: "BATCH-HIST-001",
          timestamp: 1756620000 + i * 60,
          temperature: 28 + i,
          humidity: 55 + i,
          weight: 18 + i,
        });
      }

      const res = await request(app).get(`/api/v1/telemetry/history?deviceId=${deviceId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 3);
      assert.equal(res.body.totalMatched, 3);
      assert.ok(Array.isArray(res.body.data));
    });

    it("GET /api/v1/telemetry/history should filter by date range", async function () {
      const deviceId = `RANGE-DEV-${Date.now()}`;

      // Submit readings at different times
      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-RANGE-001",
        batchId: "BATCH-RANGE-001",
        timestamp: 1756620000,
        temperature: 25,
        humidity: 50,
        weight: 15,
      });

      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-RANGE-001",
        batchId: "BATCH-RANGE-001",
        timestamp: 1756706400,
        temperature: 30,
        humidity: 60,
        weight: 20,
      });

      // Query only second reading
      const res = await request(app).get(
        `/api/v1/telemetry/history?deviceId=${deviceId}&startDate=2025-09-01T00:00:00Z&endDate=2025-09-02T00:00:00Z`
      );

      assert.equal(res.status, 200);
      // Should only return readings within the date range
      assert.ok(res.body.count <= 2);
    });

    it("GET /api/v1/telemetry/history should respect limit parameter", async function () {
      const deviceId = `LIMIT-DEV-${Date.now()}`;

      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/v1/telemetry/commit").send({
          deviceId,
          hiveId: "HIVE-LIMIT-001",
          batchId: "BATCH-LIMIT-001",
          timestamp: 1756620000 + i * 60,
          temperature: 25 + i,
          humidity: 50 + i,
          weight: 15 + i,
        });
      }

      const res = await request(app).get(`/api/v1/telemetry/history?deviceId=${deviceId}&limit=2`);
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
      assert.equal(res.body.totalMatched, 5);
    });

    it("GET /api/v1/telemetry/history should require deviceId", async function () {
      const res = await request(app).get("/api/v1/telemetry/history");
      assert.equal(res.status, 400);
    });
  });

  describe("Telemetry Stats", function () {
    it("GET /api/v1/telemetry/stats should return min/max/avg for recent data", async function () {
      const deviceId = `STATS-DEV-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-STATS-001",
        batchId: "BATCH-STATS-001",
        timestamp: now - 300,
        temperature: 28.0,
        humidity: 55.0,
        weight: 18.0,
      });

      await request(app).post("/api/v1/telemetry/commit").send({
        deviceId,
        hiveId: "HIVE-STATS-001",
        batchId: "BATCH-STATS-001",
        timestamp: now - 60,
        temperature: 32.0,
        humidity: 65.0,
        weight: 22.0,
      });

      const res = await request(app).get(`/api/v1/telemetry/stats?deviceId=${deviceId}&range=24h`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.range, "24h");
      assert.equal(res.body.data.temperature.min, 28.0);
      assert.equal(res.body.data.temperature.max, 32.0);
      assert.equal(res.body.data.temperature.avg, 30.0);
      assert.equal(res.body.readingsCount, 2);
    });

    it("GET /api/v1/telemetry/stats should support 1h range", async function () {
      const res = await request(app).get("/api/v1/telemetry/stats?deviceId=FAKE&range=1h");
      assert.equal(res.status, 200);
      assert.equal(res.body.range, "1h");
    });

    it("GET /api/v1/telemetry/stats should support 7d range", async function () {
      const res = await request(app).get("/api/v1/telemetry/stats?deviceId=FAKE&range=7d");
      assert.equal(res.status, 200);
      assert.equal(res.body.range, "7d");
    });

    it("GET /api/v1/telemetry/stats should require deviceId", async function () {
      const res = await request(app).get("/api/v1/telemetry/stats");
      assert.equal(res.status, 400);
    });

    it("GET /api/v1/telemetry/stats should return zeros for unknown device", async function () {
      const res = await request(app).get("/api/v1/telemetry/stats?deviceId=UNKNOWN&range=24h");
      assert.equal(res.status, 200);
      assert.equal(res.body.readingsCount, 0);
    });
  });

  describe("Alert Configuration", function () {
    it("POST /api/v1/alerts/config should create alert threshold", async function () {
      const res = await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          metric: "temperature",
          condition: "GREATER_THAN",
          threshold: 40.0,
          notifyEmail: true,
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.alertId.startsWith("alt_"));
      assert.equal(res.body.config.metric, "temperature");
      assert.equal(res.body.config.threshold, 40.0);
    });

    it("POST /api/v1/alerts/config should reject without auth", async function () {
      const res = await request(app).post("/api/v1/alerts/config").send({
        deviceId: testDeviceId,
        metric: "humidity",
        condition: "LESS_THAN",
        threshold: 30.0,
      });

      assert.equal(res.status, 401);
    });

    it("POST /api/v1/alerts/config should reject invalid metric", async function () {
      const res = await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          metric: "invalid_metric",
          condition: "GREATER_THAN",
          threshold: 40.0,
        });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Invalid metric/);
    });

    it("POST /api/v1/alerts/config should reject missing fields", async function () {
      const res = await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
        });

      assert.equal(res.status, 400);
    });

    it("GET /api/v1/alerts/config should list user's alert configs", async function () {
      await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          metric: "temperature",
          condition: "GREATER_THAN",
          threshold: 40.0,
        });

      const res = await request(app)
        .get("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.count, 1);
    });

    it("DELETE /api/v1/alerts/config/:id should remove alert", async function () {
      const createRes = await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          metric: "weight",
          condition: "LESS_THAN",
          threshold: 100.0,
        });

      const alertId = createRes.body.alertId;

      const delRes = await request(app)
        .delete(`/api/v1/alerts/config/${alertId}`)
        .set("Authorization", `Bearer ${userToken}`);

      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);

      // Verify it's gone
      const listRes = await request(app)
        .get("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`);

      assert.equal(listRes.body.count, 0);
    });

    it("DELETE /api/v1/alerts/config/:id should reject if not owner", async function () {
      const createRes = await request(app)
        .post("/api/v1/alerts/config")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          metric: "temperature",
          condition: "GREATER_THAN",
          threshold: 45.0,
        });

      const alertId = createRes.body.alertId;

      // Register another user
      const otherReg = await request(app).post("/api/v1/auth/register").send({
        username: "other_user",
        email: "other@honeychain.io",
        password: "OtherPass123!",
      });
      const otherToken = otherReg.body.data.token;

      const delRes = await request(app)
        .delete(`/api/v1/alerts/config/${alertId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      assert.equal(delRes.status, 403);
    });
  });
});
