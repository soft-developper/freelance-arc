import { initiateDeveloperControlledWalletsClient, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;

  if (!apiKey) {
    console.error("CIRCLE_API_KEY not found in .env");
    process.exit(1);
  }

  console.log("✅ API Key found\n");

  // Step 1 — Generate entity secret
  console.log("Step 1 — Generating entity secret...");
  const entitySecret = crypto.randomBytes(32).toString("hex");
  console.log("Entity Secret:", entitySecret);

  // Step 2 — Register entity secret
  console.log("\nStep 2 — Registering entity secret with Circle...");
  try {
    const result = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
    });
    console.log("✅ Entity secret registered!");
    console.log("Recovery file — save this offline:");
    console.log(JSON.stringify(result.data?.recoveryFile || result, null, 2));
  } catch (e) {
    if (e.message?.includes("already been set")) {
      console.log("⚠️  Entity secret already registered — this API key already has one.");
      console.log("Please create a completely new API key in Circle Console and update CIRCLE_API_KEY in .env");
      process.exit(1);
    }
    throw e;
  }

  // Step 3 — Create wallet set
  console.log("\nStep 3 — Creating wallet set...");
  const sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletSetResponse = await sdk.createWalletSet({
    idempotencyKey: crypto.randomUUID(),
    name: "FreelanceArc AI Agent",
  });

  const walletSetId = walletSetResponse.data?.walletSet?.id;
  if (!walletSetId) {
    console.error("Failed to create wallet set:", JSON.stringify(walletSetResponse, null, 2));
    process.exit(1);
  }
  console.log("✅ Wallet Set ID:", walletSetId);

  // Step 4 — Create wallet on Arc Testnet
  console.log("\nStep 4 — Creating AI agent wallet on Arc Testnet...");
  const walletResponse = await sdk.createWallets({
    idempotencyKey: crypto.randomUUID(),
    accountType: "EOA",
    blockchains: ["ARC-TESTNET"],
    count: 1,
    walletSetId,
    metadata: [{ name: "FreelanceArc AI Agent", refId: "ai-agent-001" }],
  });

  const wallet = walletResponse.data?.wallets?.[0];
  if (!wallet) {
    console.error("Failed to create wallet:", JSON.stringify(walletResponse, null, 2));
    process.exit(1);
  }

  console.log("✅ Wallet created!");
  console.log("Wallet ID:", wallet.id);
  console.log("Address:", wallet.address);
  console.log("Blockchain:", wallet.blockchain);

  // Step 5 — Save everything to .env
  const envPath = resolve(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf8");

  const updates = {
    CIRCLE_ENTITY_SECRET:    entitySecret,
    CIRCLE_WALLET_SET_ID:    walletSetId,
    CIRCLE_AGENT_WALLET_ID:  wallet.id,
    AI_AGENT_ADDRESS:        wallet.address,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (envContent.includes(key + "=")) {
      envContent = envContent.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log("\n✅ All values saved to .env automatically!");

  console.log("\n═══════════════════════════════════════");
  console.log("  Setup Complete!");
  console.log("═══════════════════════════════════════");
  console.log("Entity Secret:   ", entitySecret);
  console.log("Wallet Set ID:   ", walletSetId);
  console.log("Agent Wallet ID: ", wallet.id);
  console.log("Agent Address:   ", wallet.address);
  console.log("\nNext step: Fund the agent wallet with USDC");
  console.log("Go to: https://faucet.circle.com");
  console.log("Network: Arc Testnet");
  console.log("Address:", wallet.address);
}

main().catch((e) => {
  console.error("\nError:", e.message);
  if (e.response?.data) console.error("Details:", JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
