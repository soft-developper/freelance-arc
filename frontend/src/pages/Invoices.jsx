import { useState, useEffect } from "react";
import { formatUSDC, shortAddr, ARC_TESTNET } from "../utils/arc";

export default function Invoices({ wallet }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!wallet.address) return;
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/invoices?address=${wallet.address}`)
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet.address]);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 4 }}>Invoices</h1>
        <p style={{ color: "#7a8099", fontSize: "0.875rem" }}>Auto-generated invoices linked to your escrow jobs.</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", gap: 12, color: "#7a8099" }}><span className="spinner" /> Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48, color: "#7a8099" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>📄</div>
          <p>No invoices yet. They are created automatically when jobs are posted.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 120px 90px", padding: "8px 16px",
            fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Invoice #</span><span>Client</span><span>Freelancer</span><span>Amount</span><span>Status</span>
          </div>
          {invoices.map((inv, i) => (
            <div key={i} className="card" style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 120px 90px", padding: "14px 16px", alignItems: "center", borderRadius: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.82rem", color: "#00d4aa" }}>INV-{inv.invoice_number}</span>
              <span className="addr">{shortAddr(inv.client)}</span>
              <span className="addr">{inv.freelancer ? shortAddr(inv.freelancer) : <span style={{ color: "#4a5068" }}>Pending</span>}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{inv.amount_display} USDC</span>
              <span className={`badge ${inv.paid ? "badge-completed" : "badge-open"}`}>{inv.paid ? "Paid" : "Pending"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
