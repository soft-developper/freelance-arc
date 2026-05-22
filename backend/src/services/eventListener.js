import { ethers } from "ethers";
import { db } from "../db.js";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const ESCROW_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title)",
  "event JobAccepted(uint256 indexed jobId, address indexed freelancer)",
  "event DeliverableSubmitted(uint256 indexed jobId, string deliverableHash)",
  "event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 amountReleased)",
  "event JobDisputed(uint256 indexed jobId, address indexed raisedBy)",
];


export async function startEventListener() {
  const escrowAddress = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
  if (!escrowAddress) {
    console.warn("⚠️  No VITE_ESCROW_CONTRACT_ADDRESS — event listener disabled");
    return;
  }

  const rpcUrl = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    polling: true,
    pollingInterval: 4000,
  });
  const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);

  console.log(`👂  Listening to escrow events on Arc Testnet...`);

  escrow.on("JobCreated", async (jobId, client, totalAmount, title, event) => {
    console.log(`📋  JobCreated: #${jobId} — ${title}`);
    try {
      await db.execute({
        sql: `INSERT INTO jobs (job_id, client, title, total_amount, status, tx_hash)
              VALUES (?, ?, ?, ?, 0, ?)
              ON CONFLICT(job_id) DO NOTHING`,
        args: [jobId.toString(), client.toLowerCase(), title, totalAmount.toString(), event.log.transactionHash],
      });

      const lastResult = await db.execute(`SELECT MAX(invoice_number) as last FROM invoices`);
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
          event.log.transactionHash,
        ],
      });
    } catch (err) {
      console.error("JobCreated error:", err.message);
    }
  });

  escrow.on("JobAccepted", async (jobId, freelancer) => {
    console.log(`🤝  JobAccepted: #${jobId}`);
    await db.execute({
      sql: `UPDATE jobs SET freelancer = ?, status = 1 WHERE job_id = ?`,
      args: [freelancer.toLowerCase(), jobId.toString()],
    });
    await db.execute({
      sql: `UPDATE invoices SET freelancer = ? WHERE job_id = ?`,
      args: [freelancer.toLowerCase(), jobId.toString()],
    });
  });

  escrow.on("DeliverableSubmitted", async (jobId, deliverableHash) => {
    console.log(`📦  DeliverableSubmitted: #${jobId}`);
    await db.execute({
      sql: `UPDATE jobs SET deliverable_hash = ?, status = 2 WHERE job_id = ?`,
      args: [deliverableHash, jobId.toString()],
    });
  });

  escrow.on("JobCompleted", async (jobId) => {
    console.log(`✅  JobCompleted: #${jobId}`);
    await db.execute({
      sql: `UPDATE jobs SET status = 3 WHERE job_id = ?`,
      args: [jobId.toString()],
    });
    await db.execute({
      sql: `UPDATE invoices SET paid = 1, paid_at = datetime('now') WHERE job_id = ?`,
      args: [jobId.toString()],
    });
  });

  escrow.on("JobDisputed", async (jobId) => {
    console.log(`⚖️  JobDisputed: #${jobId}`);
    await db.execute({
      sql: `UPDATE jobs SET status = 4 WHERE job_id = ?`,
      args: [jobId.toString()],
    });
  });

  provider.on("error", (err) => {
    console.error("Provider error:", err.message);
  });
}
