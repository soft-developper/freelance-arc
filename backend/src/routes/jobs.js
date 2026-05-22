import express from "express";
import { db } from "../db.js";

const router = express.Router();

// GET /api/jobs?address=0x...
router.get("/", async (req, res) => {
  try {
    const { address, status } = req.query;
    let sql = `SELECT * FROM jobs WHERE 1=1`;
    const args = [];

    if (address) {
      const addr = address.toLowerCase();
      sql += ` AND (client = ? OR freelancer = ?)`;
      args.push(addr, addr);
    }
    if (status !== undefined) {
      sql += ` AND status = ?`;
      args.push(Number(status));
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:jobId
router.get("/:jobId", async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE job_id = ?`,
      args: [req.params.jobId],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs
router.post("/", async (req, res) => {
  try {
    const { jobId, client, title, totalAmount, platformFee, txHash } = req.body;

    await db.execute({
      sql: `INSERT INTO jobs (job_id, client, title, total_amount, platform_fee, tx_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
              title = excluded.title,
              total_amount = excluded.total_amount,
              tx_hash = excluded.tx_hash`,
      args: [jobId, client?.toLowerCase(), title, totalAmount, platformFee || null, txHash || null],
    });

    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE job_id = ?`,
      args: [jobId],
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:jobId
router.patch("/:jobId", async (req, res) => {
  try {
    const { freelancer, status, deliverableHash } = req.body;
    const updates = [];
    const args = [];

    if (freelancer !== undefined) { updates.push(`freelancer = ?`); args.push(freelancer.toLowerCase()); }
    if (status !== undefined)     { updates.push(`status = ?`);     args.push(status); }
    if (deliverableHash !== undefined) { updates.push(`deliverable_hash = ?`); args.push(deliverableHash); }

    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

    args.push(req.params.jobId);
    await db.execute({
      sql: `UPDATE jobs SET ${updates.join(", ")} WHERE job_id = ?`,
      args,
    });

    const result = await db.execute({
      sql: `SELECT * FROM jobs WHERE job_id = ?`,
      args: [req.params.jobId],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
