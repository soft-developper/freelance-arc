import express from "express";
import { db } from "../db.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";
import { ethers } from "ethers";

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ESCROW_ABI = [
  "function getJob(uint256 jobId) view returns (tuple(uint256 id, address client, address freelancer, uint256 totalAmount, uint256 platformFee, string title, string descriptionHash, uint8 status, uint256 createdAt, uint256 disputedAt, uint256 deadlineDuration, uint256 acceptedAt, uint256 clientSplitPercent, bool freelancerAgreedToSplit, tuple(string description, uint256 amount, uint8 status, string deliverableHash, uint256 submittedAt)[] milestones))",
];

// Lazy init — reads env at call time not module load time
function getEscrowContract() {
  const rpcUrl        = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  const escrowAddress = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
  const provider      = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(escrowAddress, ESCROW_ABI, provider);
}

async function getJobFromChain(jobId) {
  try {
    const escrow = getEscrowContract();
    const job    = await escrow.getJob(BigInt(jobId));
    if (!job || job.id === 0n) return null;
    return {
      client:     job.client.toLowerCase(),
      freelancer: job.freelancer.toLowerCase(),
      status:     Number(job.status),
    };
  } catch (e) {
    console.error("getJobFromChain error:", e.message);
    return null;
  }
}

// Multer — store in memory, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only images and audio files are allowed"));
  },
});

function uploadToCloudinary(buffer, mimetype, jobId) {
  return new Promise((resolve, reject) => {
    const isAudio      = mimetype.startsWith("audio/");
    const resourceType = isAudio ? "video" : "image";
    const folder       = `freelance-arc/job-${jobId}`;
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

// ── GET /api/chat/:jobId ───────────────────────────────────────────
router.get("/:jobId", async (req, res) => {
  const { jobId }   = req.params;
  const { address } = req.query;

  if (!address) return res.status(400).json({ error: "address required" });

  try {
    console.log(`[chat] GET job #${jobId} for address ${address}`);
    console.log(`[chat] ESCROW ADDRESS: ${process.env.VITE_ESCROW_CONTRACT_ADDRESS}`);

    const job = await getJobFromChain(jobId);
    if (!job) return res.status(404).json({ error: "Job not found on chain" });

    const addr         = address.toLowerCase();
    const zeroAddr     = "0x0000000000000000000000000000000000000000";
    const hasFreelancer = job.freelancer && job.freelancer !== zeroAddr;

    if (addr !== job.client && (!hasFreelancer || addr !== job.freelancer)) {
      return res.status(403).json({ error: "Not a party to this job" });
    }

    const result = await db.execute({
      sql:  `SELECT * FROM job_messages WHERE job_id = ? ORDER BY created_at ASC`,
      args: [jobId],
    });

    res.json({ messages: result.rows });
  } catch (err) {
    console.error("GET chat error:", err.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ── POST /api/chat/:jobId ──────────────────────────────────────────
router.post("/:jobId", upload.single("file"), async (req, res) => {
  const { jobId }           = req.params;
  const { sender, message } = req.body;

  if (!sender) return res.status(400).json({ error: "sender required" });
  if (!message?.trim() && !req.file) return res.status(400).json({ error: "message or file required" });

  try {
    console.log(`[chat] POST job #${jobId} from sender ${sender}`);
    console.log(`[chat] ESCROW ADDRESS: ${process.env.VITE_ESCROW_CONTRACT_ADDRESS}`);

    const job = await getJobFromChain(jobId);
    if (!job) return res.status(404).json({ error: "Job not found on chain" });

    const addr     = sender.toLowerCase();
    const zeroAddr = "0x0000000000000000000000000000000000000000";

    if (addr !== job.client && addr !== job.freelancer) {
      return res.status(403).json({ error: "Not a party to this job" });
    }
    if (job.status !== 1) {
      return res.status(400).json({ error: "Chat only available for active jobs" });
    }
    if (job.freelancer === zeroAddr) {
      return res.status(400).json({ error: "No freelancer assigned yet" });
    }

    let file_url  = null;
    let file_type = null;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, jobId);
      file_url  = result.secure_url;
      file_type = req.file.mimetype.startsWith("audio/") ? "audio" : "image";
    }

    await db.execute({
      sql:  `INSERT INTO job_messages (job_id, sender, message, file_url, file_type, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [jobId, addr, message?.trim() || "", file_url, file_type],
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("POST chat error:", err.message);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

export default router;
