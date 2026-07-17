const hre = require("hardhat");

async function main() {
  // USDC on Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  // USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const usdcAddress = hre.network.name === "base"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  console.log(`Deploying CommitmentEscrowV2 on ${hre.network.name}...`);
  console.log(`USDC address: ${usdcAddress}`);

  const Escrow = await hre.ethers.getContractFactory("CommitmentEscrowV2");
  const escrow = await Escrow.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log(`CommitmentEscrowV2 deployed to: ${address}`);
  console.log("");
  console.log("Point your MAST MCP at it: run mast_setup with this address,");
  console.log("or edit escrowContract in ~/.mast/config.json.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
