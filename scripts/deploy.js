const { ethers } = require("hardhat");

// Arc Testnet USDC ERC-20 address (6 decimals interface)
const USDC_ARC_TESTNET = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n═══════════════════════════════════════════");
  console.log("  FreelanceArc — Deployment to Arc Testnet");
  console.log("═══════════════════════════════════════════");
  console.log(`\n  Deployer:  ${deployer.address}`);

  // Check USDC balance (USDC is gas on Arc)
  const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(USDC_ARC_TESTNET, usdcAbi, deployer);
  const balance = await usdc.balanceOf(deployer.address);
  console.log(`  USDC bal:  ${ethers.formatUnits(balance, 6)} USDC\n`);

  if (balance === 0n) {
    console.warn("  ⚠️  Warning: No USDC balance. Get testnet USDC at https://faucet.circle.com");
  }

  // ─── 1. Deploy FreelanceEscrow ──────────────────────────────────────────
  console.log("  [1/2] Deploying FreelanceEscrow...");
  const FreelanceEscrow = await ethers.getContractFactory("FreelanceEscrow");
  const escrow = await FreelanceEscrow.deploy(
    USDC_ARC_TESTNET,
    deployer.address // fee recipient = deployer for now
  );
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`  ✅  FreelanceEscrow: ${escrowAddr}`);

  // ─── 2. Deploy InvoiceRegistry ─────────────────────────────────────────
  console.log("\n  [2/2] Deploying InvoiceRegistry...");
  const InvoiceRegistry = await ethers.getContractFactory("InvoiceRegistry");
  const registry = await InvoiceRegistry.deploy(escrowAddr);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`  ✅  InvoiceRegistry: ${registryAddr}`);

  // ─── Summary ───────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`
  Network:          Arc Testnet (Chain ID: 5042002)
  USDC:             ${USDC_ARC_TESTNET}
  FreelanceEscrow:  ${escrowAddr}
  InvoiceRegistry:  ${registryAddr}

  Explorer:
    Escrow:   https://testnet.arcscan.app/address/${escrowAddr}
    Registry: https://testnet.arcscan.app/address/${registryAddr}

  Next steps:
    1. Copy addresses above into your .env file
    2. Run: cd frontend && npm run dev
    3. Run: cd backend && npm run dev
  `);

  // Write to deployments file for frontend/backend to consume
  const fs = require("fs");
  const deployments = {
    network: "arc-testnet",
    chainId: 5042002,
    usdc: USDC_ARC_TESTNET,
    escrow: escrowAddr,
    invoiceRegistry: registryAddr,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(
    "./deployments.json",
    JSON.stringify(deployments, null, 2)
  );
  console.log("  📄  Saved to deployments.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
