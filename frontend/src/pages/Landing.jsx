import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";

function FAQ() {
  const [open, setOpen] = useState(null);

  const faqs = [
    { q: "How does the escrow work?", a: "When a client posts a job, the USDC is immediately locked in a smart contract on Arc. The funds stay there until the client approves the deliverable. Neither party can touch the funds until the job is resolved." },
    { q: "What happens if the client never approves my work?", a: "If the client does not respond within 7 days of you submitting your deliverable, you can claim your payment automatically using the Claim Payment button. No admin needed." },
    { q: "What currency is used for payments?", a: "All payments are made in USDC — a stable coin pegged to the US dollar. There is no price volatility. Arc also uses USDC as its gas token so you never need ETH." },
    { q: "What happens if there is a dispute?", a: "Either party can raise a dispute. This opens a chat where both parties communicate on-chain. The client can approve, request revision, or propose a split. If no agreement in 7 days, a platform admin steps in." },
    { q: "How much does it cost to use Freelance?", a: "The platform charges a 1% fee on each milestone approval. There are also small gas fees paid in USDC on Arc which are very low." },
    { q: "Can I split a job into multiple milestones?", a: "Yes. When posting a job you can add as many milestones as you need. As a client you can release each milestone individually as the freelancer completes each phase." },
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
            background: open === i ? "rgba(245,158,11,0.06)" : "transparent",
          }}>
            <span style={{ fontWeight: 500, fontSize: "0.95rem", color: "#f0e6d8" }}>{faq.q}</span>
            <span style={{
              color: "#f59e0b", fontSize: "1.1rem", fontWeight: 700,
              transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              transition: "transform 0.2s", flexShrink: 0, marginLeft: 12,
            }}>+</span>
          </div>
          {open === i && (
            <div style={{ padding: "0 20px 16px", color: "#b09878", fontSize: "0.875rem", lineHeight: 1.7, borderTop: "1px solid #332b22" }}>
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
    { icon: "⚡", title: "Instant Settlement",  desc: "USDC released in 1 second on Arc. No waiting." },
    { icon: "🔒", title: "Escrow Protection",   desc: "Funds locked in smart contract until work is approved." },
    { icon: "📄", title: "Auto Invoices",        desc: "Invoices generated automatically on job creation." },
    { icon: "🔗", title: "Multi-Milestone",      desc: "Split projects into phases with separate escrow releases." },
    { icon: "🪙", title: "USDC Native",          desc: "Pay in USDC. No ETH needed. Gas paid in USDC on Arc." },
    { icon: "🛡", title: "Dispute Resolution",   desc: "Built-in arbitration with 7-day negotiation window." },
  ];

  const steps = [
    { n: "1", label: "Post Job",           sub: "Deposit USDC to escrow" },
    { n: "2", label: "Freelancer Accepts", sub: "Job goes Active"         },
    { n: "3", label: "Submit Work",        sub: "Per milestone on-chain"  },
    { n: "4", label: "Client Approves",           sub: "USDC released instantly" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 48 }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 64 }}>
        <div style={{ marginBottom: 20 }}>
          <span className="arc-tag">Built on Arc Testnet</span>
        </div>

        <h1 style={{
          fontSize: "3.2rem", marginBottom: 20, lineHeight: 1.1,
          background: "linear-gradient(135deg, #f0e6d8 0%, #f59e0b 50%, #ef4444 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Freelance payments,<br />settled on-chain.
        </h1>

        <p style={{ color: "#b09878", fontSize: "1.1rem", maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7 }}>
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
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg">
            Get Testnet USDC
          </a>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: 48, padding: 36 }}>
        <h2 style={{ textAlign: "center", marginBottom: 32, fontSize: "0.85rem", color: "#b09878", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          How it works
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ flex: 1, textAlign: "center", padding: "18px 10px", background: "#1c1814", borderRadius: 12, minWidth: 130 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "monospace", fontSize: "0.8rem", color: "#1c1814", fontWeight: 700, marginBottom: 10,
                }}>
                  {step.n}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f0e6d8" }}>{step.label}</div>
                <div style={{ fontSize: "0.72rem", color: "#b09878", marginTop: 4 }}>{step.sub}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ color: "#4a3d30", fontSize: "1.4rem", padding: "0 6px", flexShrink: 0 }}>{">"}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid-3" style={{ marginBottom: 64 }}>
        {features.map((f) => (
          <div key={f.title} className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: "1.6rem", marginBottom: 10 }}>{f.icon}</div>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 6, color: "#f0e6d8" }}>{f.title}</h3>
            <p style={{ color: "#b09878", fontSize: "0.82rem", lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        marginBottom: 64, padding: 32, borderRadius: 20,
        background: "linear-gradient(135deg, #252018, #2e2720)",
        border: "1px solid #4a3d30",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, textAlign: "center" }}>
          {[
            { value: "1%",    label: "Platform Fee"      },
            { value: "~1s",   label: "Settlement Time"   },
            { value: "USDC",  label: "No ETH Needed"     },
          ].map((s) => (
            <div key={s.label}>
              <div style={{
                fontSize: "2.4rem", fontWeight: 800, marginBottom: 6,
                fontFamily: "'Space Grotesk', sans-serif",
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {s.value}
              </div>
              <div style={{ color: "#b09878", fontSize: "0.85rem" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: 64 }}>
        <h2 style={{ textAlign: "center", marginBottom: 32, fontSize: "1.6rem" }}>
          Frequently Asked Questions
        </h2>
        <FAQ />
      </div>

      <div style={{ textAlign: "center", color: "#7a6a58", fontSize: "0.78rem", paddingBottom: 32 }}>
        Built on Arc Testnet · USDC by Circle ·{" "}
        <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" style={{ color: "#f59e0b", textDecoration: "none" }}>
          arcscan.app
        </a>
      </div>
    </div>
  );
}
