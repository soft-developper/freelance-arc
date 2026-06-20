import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });  // ← must be BEFORE createClient

export const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS jobs (
      job_id           TEXT PRIMARY KEY,
      client           TEXT,
      freelancer       TEXT,
      title            TEXT,
      total_amount     TEXT,
      deliverable_hash TEXT,
      status           INTEGER DEFAULT 0,
      tx_hash          TEXT,
      created_at       DATETIME DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_number INTEGER PRIMARY KEY,
      job_id         TEXT,
      client         TEXT,
      freelancer     TEXT,
      amount_usdc    TEXT,
      amount_display TEXT,
      title          TEXT,
      tx_hash        TEXT,
      paid           INTEGER DEFAULT 0,
      paid_at        DATETIME,
      created_at     DATETIME DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS job_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id     TEXT NOT NULL,
      sender     TEXT NOT NULL,
      message    TEXT DEFAULT '',
      file_url   TEXT,
      file_type  TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_job_messages_job_id ON job_messages(job_id)
  `);

  console.log("✅  Turso DB tables ready");
}
