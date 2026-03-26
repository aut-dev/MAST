const hre = require("hardhat");

async function main() {
  // USDC on Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  // USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const usdcAddress = hre.network.name === "base"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  console.log(`Deploying CommitmentEscrow on ${hre.network.name}...`);
  console.log(`USDC address: ${usdcAddress}`);

  const CommitmentEscrow = await hre.ethers.getContractFactory("CommitmentEscrow");
  const escrow = await CommitmentEscrow.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`CommitmentEscrow deployed to: ${address}`);
  console.log("");
  console.log("Add this to your agent-api/.env:");
  console.log(`ESCROW_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
