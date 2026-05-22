import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, ".."), "");

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      exclude: ["@nomicfoundation/hardhat-toolbox", "@nomicfoundation/edr", "hardhat"],
    },
    define: {
      global: "globalThis",
      "import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS": JSON.stringify(env.VITE_ESCROW_CONTRACT_ADDRESS),
      "import.meta.env.VITE_INVOICE_REGISTRY_ADDRESS": JSON.stringify(env.VITE_INVOICE_REGISTRY_ADDRESS),
      "import.meta.env.VITE_USDC_ADDRESS": JSON.stringify(env.VITE_USDC_ADDRESS),
      "import.meta.env.VITE_CHAIN_ID": JSON.stringify(env.VITE_CHAIN_ID),
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL),
      "import.meta.env.VITE_ARC_EXPLORER": JSON.stringify(env.VITE_ARC_EXPLORER),
    },
  };
});
