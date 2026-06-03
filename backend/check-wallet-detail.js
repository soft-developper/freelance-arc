import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

async function main() {
  const apiKey       = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletId     = process.env.CIRCLE_AGENT_WALLET_ID;

  const sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // Get wallet details
  console.log("Getting wallet details...");
  const wallet = await sdk.getWallet({ id: walletId });
  console.log("Wallet:", JSON.stringify(wallet.data, null, 2));

  // Check wallet balance
  console.log("\nGetting wallet balance...");
  const balance = await sdk.getWalletTokenBalance({ id: walletId });
  console.log("Balance:", JSON.stringify(balance.data, null, 2));
}

main().catch(console.error);
