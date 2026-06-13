import { ethers } from "ethers";
import { db } from "../db.js";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const ESCROW_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title)",
  "event JobAccepted(uint256 indexed jobId, address indexed freelancer)",
  "event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 totalReleased)",
  "event JobDisputed(uint256 indexed jobId, address indexed raisedBy, string reason)",
  "event JobExpired(uint256 indexed jobId, address indexed expiredFreelancer)",
  "event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneIndex, string deliverableHash)",
];

const POLL_INTERVAL  = 20_000; // 20 seconds — safe for free RPC tier
const BLOCK_CHUNK    = 500;    // fetch logs in chunks to avoid oversized requests

export async function startEventListener() {
  const escrowAddress = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
  if (!escrowAddress) {
    console.warn("⚠️  No VITE_ESCROW_CONTRACT_ADDRESS — event listener disabled");
    return;
  }

  const rpcUrl   = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const escrow   = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

  console.log("👂  Listening to escrow events on Arc Testnet...");

  // Track the last block we processed so we don't re-fetch old events
  let lastBlock = null;

  async function pollEvents() {
    try {
      const currentBlock = await provider.getBlockNumber();

      // On first run start from 200 blocks back to catch recent events
      if (lastBlock === null) {
        lastBlock = Math.max(0, currentBlock - 200);
      }

      if (currentBlock <= lastBlock) return;

      // Process in chunks to stay under log size limits
      for (let from = lastBlock + 1; from <= currentBlock; from += BLOCK_CHUNK) {
        const to = Math.min(from + BLOCK_CHUNK - 1, currentBlock);

        try {
          const events = await escrow.queryFilter("*", from, to);

          for (const event of events) {
            await handleEvent(event).catch((err) =>
              console.error(`❌ Handler error [${event.fragment?.name}]:`, err.message)
            );
          }
        } catch (chunkErr) {
          // Rate limit or RPC error on this chunk — log and skip, don't crash
          console.warn(`⚠️  Chunk ${from}-${to} skipped:`, chunkErr.shortMessage || chunkErr.message);
        }
      }

      lastBlock = currentBlock;
    } catch (err) {
      // getBlockNumber failed — log and retry next interval
      console.warn("⚠️  Poll error (will retry):", err.shortMessage || err.message);
    }
  }

  async function handleEvent(event) {
    const name = event.fragment?.name;
    const args = event.args;

    if (name === "JobCreated") {
      const [jobId, client, totalAmount, title] = args;
      console.log(`📋  JobCreated: #${jobId} — ${title}`);

      await db.execute({
        sql: `INSERT INTO jobs (job_id, client, title, total_amount, status, tx_hash)
              VALUES (?, ?, ?, ?, 0, ?)
              ON CONFLICT(job_id) DO NOTHING`,
        args: [jobId.toString(), client.toLowerCase(), title, totalAmount.toString(), event.transactionHash],
      });

      const lastResult   = await db.execute(`SELECT MAX(invoice_number) as last FROM invoices`);
      const invoiceNumber = (lastResult.rows[0].last || 1000) + 1;

      await db.execute({
        sql: `INSERT INTO invoices (invoice_number, job_id, client, amount_usdc, amount_display, title, tx_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(invoice_number) DO NOTHING`,
        args: [
          invoiceNumber,
          jobId.toString(),
          client.toLowerCase(),
          totalAmount.toString(),
          (Number(totalAmount) / 1_000_000).toFixed(2),
          title,
          event.transactionHash,
        ],
      });
    }

    else if (name === "JobAccepted") {
      const [jobId, freelancer] = args;
      console.log(`🤝  JobAccepted: #${jobId}`);

      await db.execute({
        sql: `UPDATE jobs SET freelancer = ?, status = 1 WHERE job_id = ?`,
        args: [freelancer.toLowerCase(), jobId.toString()],
      });
      await db.execute({
        sql: `UPDATE invoices SET freelancer = ? WHERE job_id = ?`,
        args: [freelancer.toLowerCase(), jobId.toString()],
      });
    }

    else if (name === "MilestoneSubmitted") {
      const [jobId, milestoneIndex, deliverableHash] = args;
      console.log(`📦  MilestoneSubmitted: #${jobId} milestone ${milestoneIndex}`);

      await db.execute({
        sql: `UPDATE jobs SET deliverable_hash = ?, status = 2 WHERE job_id = ?`,
        args: [deliverableHash, jobId.toString()],
      });
    }

    else if (name === "JobCompleted") {
      const [jobId] = args;
      console.log(`✅  JobCompleted: #${jobId}`);

      await db.execute({
        sql: `UPDATE jobs SET status = 3 WHERE job_id = ?`,
        args: [jobId.toString()],
      });
      await db.execute({
        sql: `UPDATE invoices SET paid = 1, paid_at = datetime('now') WHERE job_id = ?`,
        args: [jobId.toString()],
      });
    }

    else if (name === "JobDisputed") {
      const [jobId] = args;
      console.log(`⚖️  JobDisputed: #${jobId}`);

      await db.execute({
        sql: `UPDATE jobs SET status = 4 WHERE job_id = ?`,
        args: [jobId.toString()],
      });
    }

    else if (name === "JobExpired") {
      const [jobId, expiredFreelancer] = args;
      console.log(`⏰  JobExpired: #${jobId} — freelancer ${expiredFreelancer} removed`);

      await db.execute({
        sql: `UPDATE jobs SET freelancer = NULL, status = 0 WHERE job_id = ?`,
        args: [jobId.toString()],
      });
    }
  }

  // Run immediately then on interval
  await pollEvents();
  setInterval(async () => {
    try {
      await pollEvents();
    } catch (err) {
      // Belt-and-suspenders — pollEvents already catches internally
      console.warn("⚠️  Interval poll error:", err.message);
    }
  }, POLL_INTERVAL);
}
