import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function HowToUseModal({ onClose }) {
  const [tab, setTab] = useState("client");

  const clientSteps = [
    { n: "1", title: "Connect Your Wallet",  desc: "Click Connect Wallet and choose your preferred wallet. The app runs on Arc Testnet which uses USDC as its currency. No ETH needed." },
    { n: "2", title: "Get Testnet USDC",      desc: "Visit faucet.circle.com, select Arc Testnet and USDC, paste your wallet address and click Send. You will receive free testnet USDC within seconds." },
    { n: "3", title: "Post a Job",            desc: "Click Post Job in the navbar. Fill in the job title, description, contact info and add milestones with USDC amounts. Click Deposit USDC and Post Job." },
    { n: "4", title: "Wait for a Freelancer", desc: "Your job is visible to all freelancers on the Browse Open Jobs tab. Once a freelancer accepts, the job status changes to Active." },
    { n: "5", title: "Review Milestones",     desc: "When the freelancer submits a milestone, review it and approve to release payment, or request a revision if changes are needed." },
    { n: "6", title: "Handle Issues",         desc: "If there is a bigger problem, raise a dispute to open a chat. You can negotiate, propose a split payment, or request a revision." },
  ];

  const freelancerSteps = [
    { n: "1", title: "Connect Your Wallet",   desc: "Click Connect Wallet and choose your preferred wallet. Make sure you are on Arc Testnet. You will need a small amount of USDC for gas fees." },
    { n: "2", title: "Browse Open Jobs",      desc: "Go to the Dashboard and click Browse Open Jobs. You will see all jobs posted by clients. Click any job to see full details." },
    { n: "3", title: "Contact the Client",    desc: "Before accepting, use the contact info on the job page to reach out to the client and discuss the scope." },
    { n: "4", title: "Accept a Job",          desc: "Click Accept Job and confirm in your wallet. USDC is already locked in escrow — you are guaranteed to get paid when the client approves." },
    { n: "5", title: "Submit Milestones",     desc: "Complete each milestone and submit your deliverable link or IPFS hash. The client reviews and releases payment per milestone." },
    { n: "6", title: "Get Paid",              desc: "Once the client approves a milestone, USDC is released to your wallet instantly. If the client ignores for 7 days, you can auto-claim." },
  ];

  const steps = tab === "client" ? clientSteps : freelancerSteps;

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#162034", border: "1px solid #2a4060", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto", padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.3rem", color: "#e0eeff" }}>How to Use Freelance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7aa8d4", cursor: "pointer", fontSize: "1.2rem" }}>x</button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 28, padding: 4, background: "#0f1a2e", borderRadius: 12, border: "1px solid #1e3048" }}>
          {["client", "freelancer"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "9px 16px", borderRadius: 8, border: "none",
              background: tab === t ? "#1e2d45" : "transparent",
              color: tab === t ? "#38bdf8" : "#7aa8d4",
              cursor: "pointer", fontSize: "0.875rem",
              fontWeight: tab === t ? 700 : 400,
              transition: "all 0.15s",
            }}>
              {t === "client" ? "I am a Client" : "I am a Freelancer"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: 16, background: "#0f1a2e", borderRadius: 12, border: "1px solid #1e3048" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace", fontSize: "0.8rem", color: "#fff", fontWeight: 700,
              }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: "0.95rem", color: "#e0eeff" }}>{step.title}</div>
                <div style={{ color: "#7aa8d4", fontSize: "0.82rem", lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 10 }}>
          <p style={{ fontSize: "0.8rem", color: "#7dd3fc", lineHeight: 1.6 }}>
            All payments are in USDC on Arc Testnet. Funds are secured by smart contracts. Gas fees are paid in USDC so you never need ETH.
          </p>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 20 }} onClick={onClose}>
          Got it, let me start
        </button>
      </div>
    </div>
  );
}

export default function Navbar({ wallet, isAdmin }) {
  const { isConnected } = wallet;
  const { pathname }    = useLocation();
  const [showHowTo, setShowHowTo] = useState(false);

  const navLink = (path) => ({
    padding: "6px 14px", borderRadius: "8px", fontSize: "0.875rem",
    textDecoration: "none",
    color: pathname === path ? "#38bdf8" : "#7aa8d4",
    background: pathname === path ? "rgba(14,165,233,0.1)" : "transparent",
    fontWeight: pathname === path ? 600 : 400,
    transition: "all 0.15s",
    border: pathname === path ? "1px solid rgba(14,165,233,0.2)" : "1px solid transparent",
  });

  return (
    <>
      {showHowTo && <HowToUseModal onClose={() => setShowHowTo(false)} />}

      <nav style={{
        borderBottom: "1px solid #1e3048",
        padding: "0 24px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(15,26,46,0.97)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 0 #1e3048",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "1.1rem",
              background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Freelance
            </span>
          </Link>

          <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
            <button
              onClick={() => setShowHowTo(true)}
              style={{
                padding: "6px 14px", borderRadius: "8px", fontSize: "0.875rem",
                background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)",
                color: "#38bdf8", cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
              }}
            >
              How to Use
            </button>

            {isConnected && (
              <>
                {[
                  { path: "/dashboard", label: "Dashboard" },
                  { path: "/create",    label: "Post Job"  },
                  { path: "/agent",     label: "AI Agent"  },
                  { path: "/invoices",  label: "Invoices"  },
                ].map(({ path, label }) => (
                  <Link key={path} to={path} style={navLink(path)}>{label}</Link>
                ))}

                {isAdmin && (
                  <Link to="/admin" style={{
                    padding: "6px 14px", borderRadius: "8px", fontSize: "0.875rem",
                    textDecoration: "none",
                    color: pathname === "/admin" ? "#f87171" : "#7aa8d4",
                    background: pathname === "/admin" ? "rgba(239,68,68,0.1)" : "transparent",
                    fontWeight: pathname === "/admin" ? 600 : 400,
                    border: pathname === "/admin" ? "1px solid rgba(239,68,68,0.2)" : "1px solid transparent",
                    transition: "all 0.15s",
                  }}>
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
      </nav>
    </>
  );
}
