import express from "express";
import { db } from "../db.js";

const router = express.Router();

// GET /api/invoices?address=0x...
router.get("/", async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "address required" });

    const addr = address.toLowerCase();
    const result = await db.execute({
      sql: `SELECT * FROM invoices WHERE client = ? OR freelancer = ? ORDER BY created_at DESC`,
      args: [addr, addr],
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoices/:number
router.get("/:number", async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM invoices WHERE invoice_number = ?`,
      args: [req.params.number],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices
router.post("/", async (req, res) => {
  try {
    const { jobId, client, freelancer, amountUsdc, amountDisplay, title, milestones, txHash } = req.body;

    // Check if already exists
    const existing = await db.execute({
      sql: `SELECT * FROM invoices WHERE job_id = ?`,
      args: [jobId],
    });
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    // Get next invoice number
    const lastResult = await db.execute(`SELECT MAX(invoice_number) as last FROM invoices`);
    const invoiceNumber = (lastResult.rows[0].last || 1000) + 1;

    await db.execute({
      sql: `INSERT INTO invoices
        (invoice_number, job_id, client, freelancer, amount_usdc, amount_display, title, milestones, tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        invoiceNumber,
        jobId,
        client?.toLowerCase(),
        freelancer?.toLowerCase() || null,
        amountUsdc,
        amountDisplay,
        title,
        JSON.stringify(milestones || []),
        txHash || null,
      ],
    });

    const newInvoice = await db.execute({
      sql: `SELECT * FROM invoices WHERE invoice_number = ?`,
      args: [invoiceNumber],
    });
    res.status(201).json(newInvoice.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/invoices/:number/paid
router.patch("/:number/paid", async (req, res) => {
  try {
    await db.execute({
      sql: `UPDATE invoices SET paid = 1, paid_at = datetime('now') WHERE invoice_number = ?`,
      args: [req.params.number],
    });
    const result = await db.execute({
      sql: `SELECT * FROM invoices WHERE invoice_number = ?`,
      args: [req.params.number],
    });
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
