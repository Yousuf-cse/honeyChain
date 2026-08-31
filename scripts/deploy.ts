import hre from "hardhat";

async function main() {
  console.log("Deploying HoneyBatchNFT...");

  const { viem } = await hre.network.connect();

  const [deployer] = await viem.getWalletClients();

  console.log(
    "Deploying with account:",
    deployer.account.address
  );

  const honeyBatchNFT = await viem.deployContract(
    "HoneyBatchNFT"
  );

  console.log(
    "HoneyBatchNFT deployed to:",
    honeyBatchNFT.address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 