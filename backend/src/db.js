import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      job_id TEXT PRIMARY KEY,
      client TEXT NOT NULL,
      freelancer TEXT,
      title TEXT NOT NULL,
      description_hash TEXT,
      deliverable_hash TEXT,
      total_amount TEXT,
      platform_fee TEXT,
      status INTEGER DEFAULT 0,
      milestones TEXT,
      tx_hash TEXT,
      chain_id INTEGER DEFAULT 5042002,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_number INTEGER PRIMARY KEY,
      job_id TEXT NOT NULL,
      client TEXT NOT NULL,
      freelancer TEXT,
      amount_usdc TEXT,
      amount_display TEXT,
      title TEXT,
      milestones TEXT,
      ipfs_hash TEXT DEFAULT '',
      paid INTEGER DEFAULT 0,
      paid_at TEXT,
      tx_hash TEXT,
      chain_id INTEGER DEFAULT 5042002,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log("✅  Turso DB tables ready");
}
