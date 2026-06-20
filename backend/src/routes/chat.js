import express from "express";
import { db } from "../db.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(buffer, mimetype, jobId) {
  return new Promise((resolve, reject) => {
    const isAudio    = mimetype.startsWith("audio/");
    const resourceType = isAudio ? "video" : "image"; // Cloudinary uses "video" for audio
    const folder     = `freelance-arc/job-${jobId}`;

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
// Returns all messages for a job — only for client or freelancer
router.get("/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { address } = req.query;

  if (!address) return res.status(400).json({ error: "address required" });

  try {
    // Verify sender is client or freelancer
    const jobRow = await db.execute({
      sql:  `SELECT client, freelancer FROM jobs WHERE job_id = ?`,
      args: [jobId],
    });

    if (jobRow.rows.length === 0) return res.status(404).json({ error: "Job not found" });

    const { client, freelancer } = jobRow.rows[0];
    const addr = address.toLowerCase();
    if (addr !== client && addr !== freelancer) {
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
// Send a message (text, image, or audio)
router.post("/:jobId", upload.single("file"), async (req, res) => {
  const { jobId }  = req.params;
  const { sender, message } = req.body;

  if (!sender) return res.status(400).json({ error: "sender required" });
  if (!message?.trim() && !req.file) return res.status(400).json({ error: "message or file required" });

  try {
    // Verify sender is client or freelancer
    const jobRow = await db.execute({
      sql:  `SELECT client, freelancer, status FROM jobs WHERE job_id = ?`,
      args: [jobId],
    });

    if (jobRow.rows.length === 0) return res.status(404).json({ error: "Job not found" });

    const { client, freelancer, status } = jobRow.rows[0];
    const addr = sender.toLowerCase();
    if (addr !== client && addr !== freelancer) {
      return res.status(403).json({ error: "Not a party to this job" });
    }
    if (Number(status) !== 1) {
      return res.status(400).json({ error: "Chat only available for active jobs" });
    }

    let file_url  = null;
    let file_type = null;

    // Upload file to Cloudinary if provided
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
