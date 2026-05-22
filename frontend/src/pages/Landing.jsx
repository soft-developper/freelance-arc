import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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
          <span className="arc-tag">Built on Arc - Chain ID 5042002</span>
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

    </div>
  );
}
