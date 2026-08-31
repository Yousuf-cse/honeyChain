import hre from "hardhat";
import { keccak256, stringToHex, parseEther } from "viem";
import { generateTelemetryCommitment } from "../onchain/utils/commitment.js";
import { zkService } from "../onchain/services/zkService.js";
import { ipfsService } from "../onchain/services/ipfsService.js";
import type { TelemetryReading } from "../onchain/types/index.js";

async function main() {
  console.log("==================================================");
  console.log("🐝 Seeding HoneyChain Demo Scenario...");
  console.log("==================================================");

  const { viem } = await hre.network.connect();
  const [deployer, buyer, beekeeper] = await viem.getWalletClients();

  console.log("Deployer / Verifier:", deployer.account.address);
  console.log("Buyer:", buyer.account.address);
  console.log("Beekeeper:", beekeeper.account.address);

  // 1. Deploy Contracts
  const initialVkHash = keccak256(stringToHex("HONEYCHAIN_CIRCUIT_VK_V1"));
  const zkVerifier = await viem.deployContract("HoneyZKVerifier", [initialVkHash]);
  const honeyBatchNFT = await viem.deployContract("HoneyBatchNFT");
  const honeyEscrow = await viem.deployContract("HoneyEscrow");

  console.log("\n📦 Contracts Deployed:");
  console.log(" - HoneyZKVerifier:", zkVerifier.address);
  console.log(" - HoneyBatchNFT:  ", honeyBatchNFT.address);
  console.log(" - HoneyEscrow:    ", honeyEscrow.address);

  // ----------------------------------------------------------------
  // BATCH 1: RAW_HARVEST (Nilgiris Forest Cluster)
  // ----------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("1️⃣  MINTING BATCH 1: Nilgiris Multifloral Honey (RAW_HARVEST)");
  const telemetry1: TelemetryReading = {
    deviceId: "ESP32-HIVE-001",
    hiveId: "HIVE-NILGIRIS-101",
    batchId: "HONEY-2026-NIL-001",
    timestamp: 1756620000,
    temperature: 34.5,
    humidity: 62.0,
    weight: 24.5,
  };

  const { commitment: comm1 } = generateTelemetryCommitment(telemetry1);
  const meta1 = ipfsService.constructMetadataSchema({
    batchId: telemetry1.batchId,
    hiveId: telemetry1.hiveId,
    beekeeperId: "BK-NIL-42",
    clusterLocation: "Nilgiris Biosphere Reserve, Tamil Nadu",
    harvestDate: "2026-08-15",
    floralSource: "Wild Multifloral Blossom",
    telemetryCommitment: comm1,
  });
  const ipfs1 = await ipfsService.uploadJSON(meta1);

  const tx1 = await honeyBatchNFT.write.mintBatch(
    [telemetry1.batchId, telemetry1.hiveId, "BK-NIL-42", ipfs1.ipfsUri, comm1],
    { account: deployer.account }
  );

  console.log("   ✅ Minted Token #1 | Batch ID:", telemetry1.batchId);
  console.log("   🔗 Commitment:", comm1);
  console.log("   📁 IPFS URI:  ", ipfs1.ipfsUri);
  console.log("   🏷️ State:      RAW_HARVEST (0)");
  console.log("   📜 Tx Hash:   ", tx1);

  // ----------------------------------------------------------------
  // BATCH 2: LAB_VERIFIED + ESCROW FUNDED (Coorg Coffee Blossom)
  // ----------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("2️⃣  MINTING BATCH 2: Coorg Coffee Blossom (LAB_VERIFIED + ESCROW)");
  const telemetry2: TelemetryReading = {
    deviceId: "ESP32-HIVE-002",
    hiveId: "HIVE-COORG-204",
    batchId: "HONEY-2026-CRG-002",
    timestamp: 1756621000,
    temperature: 33.8,
    humidity: 58.5,
    weight: 19.8,
  };

  const { commitment: comm2 } = generateTelemetryCommitment(telemetry2);
  const proof2 = await zkService.generateProof(telemetry2);
  console.log("   🔐 Generated ZK-SNARK Quality Proof (Groth16 Envelope)");

  const meta2 = ipfsService.constructMetadataSchema({
    batchId: telemetry2.batchId,
    hiveId: telemetry2.hiveId,
    beekeeperId: "BK-CRG-88",
    clusterLocation: "Coorg Highland Cluster, Karnataka",
    harvestDate: "2026-08-20",
    floralSource: "Monofloral Coffee Blossom",
    telemetryCommitment: comm2,
    nablReport: {
      labName: "National Honey Testing Lab (NABL Accredited)",
      accreditationNumber: "NABL-TC-8891",
      testDate: "2026-08-22",
      moisturePercentage: 17.2,
      fructoseGlucoseRatio: 1.25,
      sucrosePercentage: 2.1,
      hmfContent: 12.4,
      pollenAnalysis: "Coffea arabica dominant >85%",
      adulterationDetected: false,
      status: "PASSED",
      reportDocumentCID: "bafybeidocnabl8891coorg",
    },
  });
  const ipfs2 = await ipfsService.uploadJSON(meta2);

  await honeyBatchNFT.write.mintBatch(
    [telemetry2.batchId, telemetry2.hiveId, "BK-CRG-88", ipfs2.ipfsUri, comm2],
    { account: deployer.account }
  );

  // Transition to LAB_VERIFIED
  await honeyBatchNFT.write.updateState([2n, 1], { account: deployer.account });
  console.log("   ✅ Minted Token #2 & Updated State -> LAB_VERIFIED (1)");

  // Create Escrow funded with 0.5 ETH
  const escrowTx = await honeyEscrow.write.createEscrow(
    [telemetry2.batchId, 2n, beekeeper.account.address, deployer.account.address, 7n * 86400n],
    {
      account: buyer.account,
      value: parseEther("0.5"),
    }
  );
  console.log("   💰 Escrow Created & Funded with 0.5 ETH by Buyer");
  console.log("   📜 Escrow Tx:", escrowTx);

  // ----------------------------------------------------------------
  // BATCH 3: PACKAGED_RETAIL + ESCROW RELEASED (Sundarbans Honey)
  // ----------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("3️⃣  MINTING BATCH 3: Sundarbans Mangrove Honey (PACKAGED_RETAIL)");
  const telemetry3: TelemetryReading = {
    deviceId: "ESP32-HIVE-003",
    hiveId: "HIVE-SUN-309",
    batchId: "HONEY-2026-SUN-003",
    timestamp: 1756622000,
    temperature: 35.1,
    humidity: 64.2,
    weight: 28.0,
  };

  const { commitment: comm3 } = generateTelemetryCommitment(telemetry3);
  const meta3 = ipfsService.constructMetadataSchema({
    batchId: telemetry3.batchId,
    hiveId: telemetry3.hiveId,
    beekeeperId: "BK-SUN-12",
    clusterLocation: "Sundarbans Delta Cluster, West Bengal",
    harvestDate: "2026-08-25",
    floralSource: "Mangrove Khalisa Blossom",
    telemetryCommitment: comm3,
  });
  const ipfs3 = await ipfsService.uploadJSON(meta3);

  await honeyBatchNFT.write.mintBatch(
    [telemetry3.batchId, telemetry3.hiveId, "BK-SUN-12", ipfs3.ipfsUri, comm3],
    { account: deployer.account }
  );

  await honeyBatchNFT.write.updateState([3n, 1], { account: deployer.account }); // LAB_VERIFIED
  await honeyBatchNFT.write.updateState([3n, 2], { account: deployer.account }); // PACKAGED_RETAIL
  console.log("   ✅ Minted Token #3 & Transitioned -> PACKAGED_RETAIL (2)");

  console.log("\n==================================================");
  console.log("✨ Demo seeding completed successfully!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("Demo seeding failed:", error);
  process.exitCode = 1;
});
