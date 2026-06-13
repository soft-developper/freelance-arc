export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: "0x4CEF52",
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
};

export const CONTRACTS = {
  USDC: "0x3600000000000000000000000000000000000000",
  ESCROW: "0xec472742CfB5134DA3f7Aa012366Dd111dc8b615",
  INVOICE_REGISTRY: "0xbc65c6176f7fB7F667c3654B1552E22F6412996e",
};

export function formatUSDC(raw) {
  if (raw === undefined || raw === null) return "0.00";
  const num = typeof raw === "bigint" ? raw : BigInt(String(raw));
  const dollars = num / 1_000_000n;
  const cents = (num % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${dollars}.${cents}`;
}

export function parseUSDC(display) {
  const [whole, frac = ""] = String(display).split(".");
  const fracPadded = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded);
}

export async function switchToArc() {
  if (!window.ethereum) throw new Error("No wallet found");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x4CEF52" }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x4CEF52",
            chainName: "Arc Testnet",
            rpcUrls: ["https://rpc.testnet.arc.network"],
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          },
        ],
      });
    }
    // Network already exists — ignore
  }
}

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function explorerLink(type, value) {
  return type === "tx"
    ? `${ARC_TESTNET.explorer}/tx/${value}`
    : `${ARC_TESTNET.explorer}/address/${value}`;
}

export const JOB_STATUS = {
  0: "Open",
  1: "Active",
  2: "Submitted",
  3: "Completed",
  4: "Disputed",
  5: "Refunded",
  6: "Cancelled",
};
