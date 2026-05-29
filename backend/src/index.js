import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB } from "./db.js";
import invoiceRoutes from "./routes/invoices.js";
import jobRoutes from "./routes/jobs.js";
import { startEventListener } from "./services/eventListener.js";
import aiRoutes from "./routes/ai.js";
dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/invoices", invoiceRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/ai", aiRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    network: "Arc Testnet",
    chainId: 5042002,
    db: "Turso",
    time: new Date().toISOString(),
  });
});

await initDB();

app.listen(PORT, () => {
  console.log(`✅  Server running on http://localhost:${PORT}`);
  console.log(`    Network: Arc Testnet (Chain ID: 5042002)`);
  console.log(`    Database: Turso (libSQL)`);
});

startEventListener().catch(console.error);
