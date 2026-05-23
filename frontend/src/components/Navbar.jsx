import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function HowToUseModal({ onClose }) {
  const [tab, setTab] = useState("client");

  const clientSteps = [
    { n: "1", title: "Connect Your Wallet", desc: "Click Connect Wallet and choose your preferred wallet. The app runs on Arc Testnet which uses USDC as its currency. No ETH needed." },
    { n: "2", title: "Get Testnet USDC", desc: "Visit faucet.circle.com, select Arc Testnet and USDC, paste your wallet address and click Send. You will receive free testnet USDC within seconds." },
    { n: "3", title: "Post a Job", desc: "Click Post Job in the navbar. Fill in the job title, description, contact info and add milestones with USDC amounts. Click Deposit USDC and Post Job." },
    { n: "4", title: "Wait for a Freelancer", desc: "Your job is visible to all freelancers on the Browse Open Jobs tab. Once a freelancer accepts, the job status changes to Active." },
    { n: "5", title: "Review Milestones", desc: "When the freelancer submits a milestone, review it and approve to release that milestone payment, or request a revision if changes are needed." },
    { n: "6", title: "Handle Issues", desc: "If there is a bigger problem, raise a dispute to open a chat. You can negotiate, propose a split payment, or request a revision until you reach an agreement." },
  ];

  const freelancerSteps = [
    { n: "1", title: "Connect Your Wallet", desc: "Click Connect Wallet and choose your preferred wallet. Make sure you are on Arc Testnet. You will need a small amount of USDC for gas fees." },
    { n: "2", title: "Browse Open Jobs", desc: "Go to the Dashboard and click Browse Open Jobs. You will see all jobs posted by clients. Click any job to see its full details including milestones and payment amounts." },
    { n: "3", title: "Contact the Client", desc: "Before accepting, use the contact info on the job page to reach out to the client. Discuss the scope and make sure you understand the requirements." },
    { n: "4", title: "Accept a Job", desc: "Click Accept Job and confirm in your wallet. The USDC is already locked in escrow — you are guaranteed to get paid as long as the client approves your work." },
    { n: "5", title: "Submit Milestones", desc: "Complete each milestone and submit your deliverable link or IPFS hash for that milestone. The client reviews and releases payment per milestone." },
    { n: "6", title: "Get Paid", desc: "Once the client approves a milestone, USDC is released to your wallet instantly. If the client does not respond within 7 days, you can claim your payment automatically." },
  ];

  const steps = tab === "client" ? clientSteps : freelancerSteps;

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#12141a", border: "1px solid #2a3050", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto", padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.3rem" }}>How to Use Freelance</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7a8099", cursor: "pointer", fontSize: "1.2rem" }}>x</button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 28, padding: 4, background: "#0a0b0f", borderRadius: 8, border: "1px solid #1f2330" }}>
          {["client", "freelancer"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "9px 16px", borderRadius: 6, border: "none",
              background: tab === t ? "#1a1d26" : "transparent",
              color: tab === t ? "#e8eaf0" : "#7a8099",
              cursor: "pointer", fontSize: "0.875rem",
              fontWeight: tab === t ? 600 : 400,
              textTransform: "capitalize",
            }}>
              {t === "client" ? "I am a Client" : "I am a Freelancer"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 16, padding: 16, background: "#1a1d26", borderRadius: 10, border: "1px solid #2a3050" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "monospace", fontSize: "0.8rem", color: "#00d4aa",
              }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.95rem" }}>{step.title}</div>
                <div style={{ color: "#7a8099", fontSize: "0.82rem", lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(0,212,170,0.05)", border: "1px solid rgba(0,212,170,0.15)", borderRadius: 8 }}>
          <p style={{ fontSize: "0.8rem", color: "#7a8099", lineHeight: 1.6 }}>
            All payments are in USDC on Arc Testnet. Funds are secured by smart contracts. No one can take your money without your consent. Gas fees are paid in USDC so you never need ETH.
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

  return (
    <>
      {showHowTo && <HowToUseModal onClose={() => setShowHowTo(false)} />}

      <nav style={{
        borderBottom: "1px solid #1f2330",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0b0f",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: "monospace" }}>
              <span style={{ color: "#00d4aa" }}>◈</span> Freelance
            </span>
          </Link>

          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              onClick={() => setShowHowTo(true)}
              style={{
                padding: "6px 14px", borderRadius: "6px", fontSize: "0.875rem",
                background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)",
                color: "#00d4aa", cursor: "pointer", fontWeight: 500,
              }}
            >
              How to Use
            </button>

            {isConnected && (
              <>
                {[
                  { path: "/dashboard", label: "Dashboard" },
                  { path: "/create",    label: "Post Job"  },
                  { path: "/invoices",  label: "Invoices"  },
                ].map(({ path, label }) => (
                  <Link key={path} to={path} style={{
                    padding: "6px 14px", borderRadius: "6px", fontSize: "0.875rem",
                    textDecoration: "none",
                    color: pathname === path ? "#00d4aa" : "#7a8099",
                    background: pathname === path ? "rgba(0,212,170,0.1)" : "transparent",
                    fontWeight: pathname === path ? 500 : 400,
                  }}>
                    {label}
                  </Link>
                ))}

                {isAdmin && (
                  <Link to="/admin" style={{
                    padding: "6px 14px", borderRadius: "6px", fontSize: "0.875rem",
                    textDecoration: "none",
                    color: pathname === "/admin" ? "#ef4444" : "#7a8099",
                    background: pathname === "/admin" ? "rgba(239,68,68,0.1)" : "transparent",
                    fontWeight: pathname === "/admin" ? 500 : 400,
                    border: "1px solid rgba(239,68,68,0.2)",
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
