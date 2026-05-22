import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function FAQ() {
  const [open, setOpen] = useState(null);

  const faqs = [
    {
      q: "How does the escrow work?",
      a: "When a client posts a job, the USDC is immediately locked in a smart contract on Arc. The funds stay there until the client approves the deliverable. Neither party can touch the funds until the job is resolved — this protects both the client and the freelancer.",
    },
    {
      q: "What happens if the client never approves my work?",
      a: "If the client does not respond within 7 days of you submitting your deliverable, you can claim your payment automatically using the Claim Payment button. No admin needed — it is enforced by the smart contract.",
    },
    {
      q: "What currency is used for payments?",
      a: "All payments are made in USDC — a stable coin pegged to the US dollar. There is no price volatility. 1 USDC always equals $1. Arc also uses USDC as its gas token so you do not need ETH or any other coin to use the platform.",
    },
    {
      q: "What happens if there is a dispute?",
      a: "Either party can raise a dispute on a submitted job. This opens a dispute chat where both the client and freelancer can communicate directly on-chain. The client can approve the work, request a revision, or propose a split payment. The freelancer can accept the split. If no agreement is reached after 7 days, a platform admin can step in to resolve it.",
    },
    {
      q: "How much does it cost to use Freelance?",
      a: "The platform charges a 1% fee on the total job amount. This is deducted automatically when the USDC is released to the freelancer. There are also small gas fees paid in USDC on the Arc network which are typically very low.",
    },
    {
      q: "Can I split a job into multiple milestones?",
      a: "Yes. When posting a job you can add as many milestones as you need, each with its own description and USDC amount. As a client you can release each milestone individually as the freelancer completes each phase of the work.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720, margin: "0 auto" }}>
      {faqs.map((faq, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
          onClick={() => setOpen(open === i ? null : i)}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px",
            background: open === i ? "rgba(0,212,170,0.05)" : "transparent",
          }}>
            <span style={{ fontWeight: 500, fontSize: "0.95rem" }}>{faq.q}</span>
            <span style={{
              color: "#00d4aa", fontSize: "1.1rem", fontWeight: 700,
              transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              flexShrink: 0, marginLeft: 12,
            }}>
              +
            </span>
          </div>
          {open === i && (
            <div style={{
              padding: "0 20px 16px",
              color: "#7a8099", fontSize: "0.875rem", lineHeight: 1.7,
              borderTop: "1px solid #1f2330",
            }}>
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Landing({ wallet }) {
  const navigate = useNavigate();

  const features = [
    { icon: "⚡", title: "Instant Settlement", desc: "USDC released in 1 second on Arc. No waiting." },
    { icon: "🔒", title: "Escrow Protection", desc: "Funds locked in smart contract until work is approved." },
    { icon: "📄", title: "Auto Invoices", desc: "Invoices generated automatically on job creation." },
    { icon: "🔗", title: "Multi-Milestone", desc: "Split projects into phases with separate escrow releases." },
    { icon: "🪙", title: "USDC Native", desc: "Pay in USDC. No ETH needed. Gas paid in USDC on Arc." },
    { icon: "🛡", title: "Dispute Resolution", desc: "Built-in arbitration with 7-day window." },
  ];

  const steps = [
    { n: "1", label: "Post Job", sub: "Deposit USDC to escrow" },
    { n: "2", label: "Freelancer Accepts", sub: "Job goes Active" },
    { n: "3", label: "Submit Work", sub: "IPFS hash on-chain" },
    { n: "4", label: "Client Approves", sub: "USDC released instantly" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingTop: 60 }}>

      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{ marginBottom: 20 }}>
          <span className="arc-tag">Built on Arc</span>
        </div>

        <h1 style={{ fontSize: "2.8rem", marginBottom: 20, lineHeight: 1.15 }}>
          Freelance payments,
          <br />
          <span style={{ color: "#00d4aa" }}>settled on-chain.</span>
        </h1>

        <p style={{ color: "#7a8099", fontSize: "1.05rem", maxWidth: 500, margin: "0 auto 36px" }}>
          Clients pay freelancers in USDC instantly via escrow smart contracts.
          Auto-invoiced. Dispute-protected. Arc-native.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", alignItems: "center" }}>
          {wallet.isConnected ? (
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/dashboard")}>
              Open Dashboard
            </button>
          ) : (
            <ConnectButton label="Connect Wallet to Start" />
          )}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-lg"
          >
            Get Testnet USDC
          </a>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 40, padding: 32 }}>
        <h2 style={{ textAlign: "center", marginBottom: 28, fontSize: "0.85rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          How it works
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ flex: 1, textAlign: "center", padding: "14px 8px", background: "#1a1d26", borderRadius: 8, minWidth: 120 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "monospace", fontSize: "0.75rem", color: "#00d4aa", marginBottom: 8,
                }}>
                  {step.n}
                </div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{step.label}</div>
                <div style={{ fontSize: "0.72rem", color: "#7a8099", marginTop: 2 }}>{step.sub}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ color: "#2a3050", fontSize: "1.2rem", padding: "0 4px" }}>{">"}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-3">
        {features.map((f) => (
          <div key={f.title} className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>{f.icon}</div>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 6 }}>{f.title}</h3>
            <p style={{ color: "#7a8099", fontSize: "0.82rem", lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    {/* FAQ */}
<div style={{ marginTop: 48 }}>
  <h2 style={{ textAlign: "center", marginBottom: 32, fontSize: "1.4rem" }}>
    Frequently Asked Questions
  </h2>
  <FAQ />
</div>
    </div>
  );
}
