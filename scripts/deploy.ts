import hre from "hardhat";
import { keccak256, stringToHex } from "viem";
import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("==================================================");
  console.log("🚀 Deploying HoneyChain Web3 Infrastructure...");
  console.log("==================================================");

  const { viem } = await hre.network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deployer account:", deployer.account.address);

  // 1. Deploy HoneyZKVerifier
  console.log("\n1. Deploying HoneyZKVerifier...");
  const initialVkHash = keccak256(stringToHex("HONEYCHAIN_CIRCUIT_VK_V1"));
  const zkVerifier = await viem.deployContract("HoneyZKVerifier", [initialVkHash]);
  console.log("   ✅ HoneyZKVerifier deployed to:", zkVerifier.address);

  // 2. Deploy HoneyBatchNFT
  console.log("\n2. Deploying HoneyBatchNFT...");
  const honeyBatchNFT = await viem.deployContract("HoneyBatchNFT");
  console.log("   ✅ HoneyBatchNFT deployed to:", honeyBatchNFT.address);

  // 3. Deploy HoneyEscrow
  console.log("\n3. Deploying HoneyEscrow...");
  const honeyEscrow = await viem.deployContract("HoneyEscrow");
  console.log("   ✅ HoneyEscrow deployed to:", honeyEscrow.address);

  // Summary object
  const deploymentInfo = {
    network: process.env.HARDHAT_NETWORK || "localhost",
    deployer: deployer.account.address,
    timestamp: new Date().toISOString(),
    contracts: {
      honeyZKVerifier: zkVerifier.address,
      honeyBatchNFT: honeyBatchNFT.address,
      honeyEscrow: honeyEscrow.address,
    },
  };

  console.log("\n==================================================");
  console.log("🎉 All contracts deployed successfully!");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("==================================================");

  // Export to deployments.json if possible
  try {
    const outPath = path.join(process.cwd(), "deployments.json");
    fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Exported deployment addresses to ${outPath}`);
  } catch (err) {
    console.warn("Could not write deployments.json:", (err as Error).message);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});