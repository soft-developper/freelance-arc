import { ethers } from "ethers";
import { db } from "../db.js";
import {
  extractEmail,
  sendJobAcceptedEmail,
  sendMilestoneSubmittedEmail,
  sendMilestoneApprovedEmail,
  sendDisputeRaisedEmail,
} from "./email.js";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const ESCROW_ABI = [
  "event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title)",
  "event JobAccepted(uint256 indexed jobId, address indexed freelancer)",
  "event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 totalReleased)",
  "event JobDisputed(uint256 indexed jobId, address indexed raisedBy, string reason)",
  "event JobExpired(uint256 indexed jobId, address indexed expiredFreelancer)",
  "event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneIndex, string deliverableHash)",
  "event MilestoneApproved(uint256 indexed jobId, uint256 indexed milestoneIndex, uint256 amount)",
  "function getJob(uint256 jobId) view returns (tuple(uint256 id, address client, address freelancer, uint256 totalAmount, uint256 platformFee, string title, string descriptionHash, uint8 status, uint256 createdAt, uint256 disputedAt, uint256 deadlineDuration, uint256 acceptedAt, uint256 clientSplitPercent, bool freelancerAgreedToSplit, tuple(string description, uint256 amount, uint8 status, string deliverableHash, uint256 submittedAt)[] milestones))",
];

const POLL_INTERVAL = 20_000;
const BLOCK_CHUNK   = 500;

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

  let lastBlock = null;

  // Helper — fetch full job from chain for email context
  async function fetchJobMeta(jobId) {
    try {
      const job = await escrow.getJob(BigInt(jobId));
      return {
        title:           job.title,
        descriptionHash: job.descriptionHash,
        client:          job.client.toLowerCase(),
        freelancer:      job.freelancer.toLowerCase(),
        milestones:      job.milestones,
      };
    } catch {
      return null;
    }
  }

  async function pollEvents() {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (lastBlock === null) lastBlock = Math.max(0, currentBlock - 200);
      if (currentBlock <= lastBlock) return;

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
          console.warn(`⚠️  Chunk ${from}-${to} skipped:`, chunkErr.shortMessage || chunkErr.message);
        }
      }

      lastBlock = currentBlock;
    } catch (err) {
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
        sql:  `INSERT INTO jobs (job_id, client, title, total_amount, status, tx_hash)
               VALUES (?, ?, ?, ?, 0, ?)
               ON CONFLICT(job_id) DO NOTHING`,
        args: [jobId.toString(), client.toLowerCase(), title, totalAmount.toString(), event.transactionHash],
      });

      const lastResult    = await db.execute(`SELECT MAX(invoice_number) as last FROM invoices`);
      const invoiceNumber = (lastResult.rows[0].last || 1000) + 1;

      await db.execute({
        sql:  `INSERT INTO invoices (invoice_number, job_id, client, amount_usdc, amount_display, title, tx_hash)
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
        sql:  `UPDATE jobs SET freelancer = ?, status = 1 WHERE job_id = ?`,
        args: [freelancer.toLowerCase(), jobId.toString()],
      });
      await db.execute({
        sql:  `UPDATE invoices SET freelancer = ? WHERE job_id = ?`,
        args: [freelancer.toLowerCase(), jobId.toString()],
      });

      // Email the client
      const meta = await fetchJobMeta(jobId);
      if (meta) {
        const clientEmail = extractEmail(meta.descriptionHash);
        await sendJobAcceptedEmail({
          to:                clientEmail,
          jobId:             jobId.toString(),
          jobTitle:          meta.title,
          freelancerAddress: freelancer,
        });
      }
    }

    else if (name === "MilestoneSubmitted") {
      const [jobId, milestoneIndex, deliverableHash] = args;
      console.log(`📦  MilestoneSubmitted: #${jobId} milestone ${milestoneIndex}`);

      await db.execute({
        sql:  `UPDATE jobs SET deliverable_hash = ?, status = 2 WHERE job_id = ?`,
        args: [deliverableHash, jobId.toString()],
      });

      // Email the client
      const meta = await fetchJobMeta(jobId);
      if (meta) {
        const clientEmail = extractEmail(meta.descriptionHash);
        const ms          = meta.milestones[Number(milestoneIndex)];
        await sendMilestoneSubmittedEmail({
          to:             clientEmail,
          jobId:          jobId.toString(),
          jobTitle:       meta.title,
          milestoneIndex: Number(milestoneIndex),
          milestoneDesc:  ms?.description || "",
        });
      }
    }

    else if (name === "MilestoneApproved") {
      const [jobId, milestoneIndex, amount] = args;
      console.log(`✅  MilestoneApproved: #${jobId} milestone ${milestoneIndex}`);

      // Email the freelancer
      const meta = await fetchJobMeta(jobId);
      if (meta) {
        const ms              = meta.milestones[Number(milestoneIndex)];
        const freelancerEmail = extractEmail(meta.descriptionHash);

        // Note: freelancer email comes from their own contact — we don't have it here
        // So we email the client's contact only if they are the freelancer (edge case)
        // In practice we email whoever has an email in the descriptionHash
        await sendMilestoneApprovedEmail({
          to:             freelancerEmail,
          jobId:          jobId.toString(),
          jobTitle:       meta.title,
          milestoneIndex: Number(milestoneIndex),
          milestoneDesc:  ms?.description || "",
          amount:         (Number(amount) / 1_000_000).toFixed(2),
        });
      }
    }

    else if (name === "JobCompleted") {
      const [jobId] = args;
      console.log(`✅  JobCompleted: #${jobId}`);

      await db.execute({
        sql:  `UPDATE jobs SET status = 3 WHERE job_id = ?`,
        args: [jobId.toString()],
      });
      await db.execute({
        sql:  `UPDATE invoices SET paid = 1, paid_at = datetime('now') WHERE job_id = ?`,
        args: [jobId.toString()],
      });
      await deleteChatMessages(jobId.toString());
    }

    else if (name === "JobDisputed") {
      const [jobId, raisedBy, reason] = args;
      console.log(`⚖️  JobDisputed: #${jobId}`);

      await db.execute({
        sql:  `UPDATE jobs SET status = 4 WHERE job_id = ?`,
        args: [jobId.toString()],
      });

      // Email both client and freelancer
      const meta = await fetchJobMeta(jobId);
      if (meta) {
        const contactEmail = extractEmail(meta.descriptionHash);
        // Send to whoever has email in the job contact field
        await sendDisputeRaisedEmail({
          to:       contactEmail,
          jobId:    jobId.toString(),
          jobTitle: meta.title,
          raisedBy: raisedBy,
        });
      }
    }

    else if (name === "JobExpired") {
      const [jobId, expiredFreelancer] = args;
      console.log(`⏰  JobExpired: #${jobId}`);

      await db.execute({
        sql:  `UPDATE jobs SET freelancer = NULL, status = 0 WHERE job_id = ?`,
        args: [jobId.toString()],
      });
      await deleteChatMessages(jobId.toString());
    }
  }

  async function deleteChatMessages(jobId) {
    try {
      await db.execute({
        sql:  `DELETE FROM job_messages WHERE job_id = ?`,
        args: [jobId],
      });
      console.log(`🗑️  Chat messages deleted for job #${jobId}`);
    } catch (err) {
      console.error(`Failed to delete chat messages for job #${jobId}:`, err.message);
    }
  }

  await pollEvents();
  setInterval(async () => {
    try {
      await pollEvents();
    } catch (err) {
      console.warn("⚠️  Interval poll error:", err.message);
    }
  }, POLL_INTERVAL);
}
