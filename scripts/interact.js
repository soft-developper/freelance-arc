const { ethers } = require("hardhat");

// Load deployed addresses
let deployments;
try {
  deployments = require("../deployments.json");
} catch {
  console.error("Run deploy.js first: npx hardhat run scripts/deploy.js --network arc-testnet");
  process.exit(1);
}

const USDC_DECIMALS = 6;
const toUSDC = (amount) => ethers.parseUnits(String(amount), USDC_DECIMALS);
const fromUSDC = (amount) => ethers.formatUnits(amount, USDC_DECIMALS);

const ESCROW_ABI = [
  "function createJob(string,string,string[],uint256[]) returns (uint256)",
  "function acceptJob(uint256)",
  "function submitDeliverable(uint256,string)",
  "function approveDeliverable(uint256)",
  "function getJob(uint256) view returns (tuple(uint256,address,address,uint256,uint256,string,string,string,uint8,uint256,uint256,uint256,tuple(string,uint256,bool)[]))",
  "function getTotalJobs() view returns (uint256)",
];

const USDC_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
];

async function main() {
  const signers = await ethers.getSigners();
  const client = signers[0];
  // For local testing use signers[1]; on testnet use a second funded wallet
  const freelancer = signers[1] || signers[0];

  console.log("\n═══════════════════════════════════════════");
  console.log("  FreelanceArc — Interaction Demo");
  console.log("═══════════════════════════════════════════\n");
  console.log(`  Client:     ${client.address}`);
  console.log(`  Freelancer: ${freelancer.address}`);
  console.log(`  Escrow:     ${deployments.escrow}\n`);

  const usdc = new ethers.Contract(deployments.usdc, USDC_ABI, client);
  const escrow = new ethers.Contract(deployments.escrow, ESCROW_ABI, client);

  // Check balance
  const clientBal = await usdc.balanceOf(client.address);
  console.log(`  Client USDC balance: ${fromUSDC(clientBal)} USDC`);

  // ─── Step 1: Approve escrow to spend USDC ──────────────────────────────
  const jobAmount = toUSDC(100); // $100 USDC
  const fee = (jobAmount * 100n) / 10000n; // 1%
  const deposit = jobAmount + fee;

  console.log("\n  [1] Approving USDC spend...");
  const approveTx = await usdc.approve(deployments.escrow, deposit);
  await approveTx.wait();
  console.log(`  ✅  Approved ${fromUSDC(deposit)} USDC for escrow`);

  // ─── Step 2: Create job ────────────────────────────────────────────────
  console.log("\n  [2] Creating job...");
  const createTx = await escrow.createJob(
    "Build Landing Page",
    "QmExampleIPFSHashForJobDescription123",
    ["Design mockup", "Development", "Testing & delivery"],
    [toUSDC(20), toUSDC(60), toUSDC(20)]
  );
  const receipt = await createTx.wait();
  console.log(`  ✅  Job created! Tx: ${receipt.hash}`);

  const totalJobs = await escrow.getTotalJobs();
  const jobId = totalJobs;
  console.log(`  📋  Job ID: ${jobId}`);

  // ─── Step 3: Freelancer accepts ────────────────────────────────────────
  console.log("\n  [3] Freelancer accepting job...");
  const escrowAsFreelancer = escrow.connect(freelancer);
  const acceptTx = await escrowAsFreelancer.acceptJob(jobId);
  await acceptTx.wait();
  console.log(`  ✅  Job accepted by ${freelancer.address}`);

  // ─── Step 4: Submit deliverable ────────────────────────────────────────
  console.log("\n  [4] Freelancer submitting deliverable...");
  const submitTx = await escrowAsFreelancer.submitDeliverable(
    jobId,
    "QmDeliverableIPFSHash456"
  );
  await submitTx.wait();
  console.log("  ✅  Deliverable submitted");

  // ─── Step 5: Client approves ───────────────────────────────────────────
  console.log("\n  [5] Client approving deliverable...");
  const approveTx2 = await escrow.approveDeliverable(jobId);
  await approveTx2.wait();
  console.log("  ✅  Job completed! USDC released to freelancer");

  // ─── Final balances ────────────────────────────────────────────────────
  const freelancerBal = await usdc.balanceOf(freelancer.address);
  console.log(`\n  Freelancer received: ${fromUSDC(freelancerBal)} USDC`);
  console.log("\n  🎉  Demo complete!\n");
  console.log(`  View on explorer: https://testnet.arcscan.app/address/${deployments.escrow}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
