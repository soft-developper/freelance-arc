import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

async function main() {
  const sdk = initiateDeveloperControlledWalletsClient({
    apiKey:       process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });

  const ESCROW        = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
  const AGENT_ADDRESS = process.env.AI_AGENT_ADDRESS;

  console.log("Agent address:", AGENT_ADDRESS);
  console.log("Escrow:", ESCROW);
  console.log("\nTesting createContractExecutionTransaction...");

  const result = await sdk.createContractExecutionTransaction({
    walletAddress:        AGENT_ADDRESS,
    blockchain:           "ARC-TESTNET",
    contractAddress:      ESCROW,
    abiFunctionSignature: "acceptJob(uint256)",
    abiParameters:        ["8"],
    idempotencyKey:       crypto.randomUUID(),
    fee: {
      type:   "level",
      config: { feeLevel: "MEDIUM" },
    },
  });

  console.log("\nResult:", JSON.stringify(result.data || result, null, 2));

  if (result.data?.id) {
    console.log("\nPolling for confirmation...");
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await sdk.getTransaction({ id: result.data.id });
      const state  = status.data?.transaction?.state;
      console.log(`[${i + 1}] State: ${state}`);
      if (state === "CONFIRMED" || state === "COMPLETE" || state === "FAILED") break;
    }
  }
}

main().catch(console.error);
