import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { formatUSDC, JOB_STATUS, shortAddr, CONTRACTS } from "../utils/arc";
import { ethers } from "ethers";
import { ESCROW_ABI } from "../abi";

function JobCard({ jobId, wallet }) {
  const { getJob } = useEscrow(wallet.signer);
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!jobId || !wallet.signer) return;
    getJob(jobId).then(setJob).catch(() => {});
    const interval = setInterval(() => {
      getJob(jobId).then(setJob).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [jobId, wallet.signer]);

  if (!job) return (
    <div className="card" style={{ padding: 16, opacity: 0.5 }}>
      <span className="spinner" />
    </div>
  );

  const statusLabel = JOB_STATUS[Number(job.status)] || "Unknown";
  const isClient = job.client?.toLowerCase() === wallet.address?.toLowerCase();

  return (
    <Link to={"/job/" + jobId} style={{ textDecoration: "none" }}>
      <div className="card" style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--text-muted)" }}>JOB #{String(jobId)}</span>
          <span className={"badge badge-" + statusLabel.toLowerCase()}>{statusLabel}</span>
        </div>
        <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>{job.title}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatUSDC(job.totalAmount)} USDC</span>
          <span style={{
            fontSize: "0.72rem",
            color: isClient ? "var(--usdc)" : "var(--primary)",
            background: isClient ? "rgba(39,117,202,0.1)" : "var(--arc-dim)",
            padding: "2px 8px", borderRadius: 4,
          }}>
            {isClient ? "CLIENT" : "FREELANCER"}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Posted by: <span className="addr">{shortAddr(job.client)}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: "0.72rem", color: "var(--text-dim)" }}>
          {new Date(Number(job.createdAt) * 1000).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard({ wallet }) {
  const { getClientJobs, getFreelancerJobs, getUSDCBalance } = useEscrow(wallet.signer);

  const [clientIds, setClientIds]         = useState([]);
  const [freelancerIds, setFreelancerIds] = useState([]);
  const [openJobIds, setOpenJobIds]       = useState([]);
  const [balance, setBalance]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [tab, setTab]                     = useState("browse");
  const [lastRefresh, setLastRefresh]     = useState(null);

  // Load my jobs + balance
  const loadMyData = useCallback(async () => {
    if (!wallet.address || !wallet.signer) return;
    try {
      const [cj, fj, bal] = await Promise.all([
        getClientJobs(wallet.address),
        getFreelancerJobs(wallet.address),
        getUSDCBalance(wallet.address),
      ]);
      setClientIds([...cj].reverse());
      setFreelancerIds([...fj].reverse());
      setBalance(bal);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("loadMyData error:", e.message);
    } finally {
      setLoading(false);
    }
  }, [wallet.address, wallet.signer]);

  // Load all open jobs
  const loadOpenJobs = useCallback(async () => {
    if (!wallet.signer) return;
    try {
      const provider = wallet.signer.provider;
      const contract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      const total    = await contract.getTotalJobs();
      const totalNum = Number(total);

      const ids = [];
      const start = Math.max(1, totalNum - 49);
      for (let i = totalNum; i >= start; i--) {
        ids.push(BigInt(i));
      }

      const jobChecks = await Promise.all(
        ids.map(async (id) => {
          try {
            const job = await contract.getJob(id);
            return Number(job.status) === 0 ? id : null;
          } catch {
            return null;
          }
        })
      );

      setOpenJobIds(jobChecks.filter(Boolean));
    } catch (e) {
      console.error("loadOpenJobs error:", e.message);
    } finally {
      setBrowseLoading(false);
    }
  }, [wallet.signer]);

  // Initial load
  useEffect(() => {
    if (!wallet.address) return;
    setLoading(true);
    setBrowseLoading(true);
    loadMyData();
    loadOpenJobs();
  }, [wallet.address]);

  // Auto refresh every 3 seconds
  useEffect(() => {
    if (!wallet.address || !wallet.signer) return;
    const interval = setInterval(() => {
      loadMyData();
      loadOpenJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, [wallet.address, wallet.signer, loadMyData, loadOpenJobs]);

  const myIds = tab === "client" ? clientIds : freelancerIds;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Browse open jobs or manage your work
            {lastRefresh && (
              <span style={{ marginLeft: 10, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { loadMyData(); loadOpenJobs(); }}
          >
            Refresh
          </button>
          <Link to="/create" className="btn btn-primary">+ Post Job</Link>
        </div>
      </div>

      {/* Balance */}
      {balance !== null && (
        <div className="card" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              USDC Balance
            </div>
            <div style={{ fontSize: "1.8rem", fontFamily: "monospace", fontWeight: 700 }}>
              {formatUSDC(balance)}{" "}
              <span style={{ fontSize: "0.9rem", color: "var(--usdc)" }}>USDC</span>
            </div>
          </div>
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            Get Testnet USDC
          </a>
        </div>
      )}

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          { label: "Open Jobs Available", value: openJobIds.length    },
          { label: "My Client Jobs",      value: clientIds.length     },
          { label: "My Freelance Jobs",   value: freelancerIds.length },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: "1.8rem", fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>
              {s.value}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20, padding: 4,
        background: "var(--bg-card)", borderRadius: 10, width: "fit-content",
        border: "1px solid var(--border)",
      }}>
        {[
          { key: "browse",     label: "Browse Open Jobs (" + openJobIds.length + ")"     },
          { key: "client",     label: "My Client Jobs (" + clientIds.length + ")"        },
          { key: "freelancer", label: "My Freelance Jobs (" + freelancerIds.length + ")" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 16px", borderRadius: 7, border: "none",
            background: tab === t.key ? "var(--bg-elevated)" : "transparent",
            color: tab === t.key ? "var(--text)" : "var(--text-muted)",
            cursor: "pointer", fontSize: "0.82rem",
            fontWeight: tab === t.key ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse open jobs */}
      {tab === "browse" && (
        browseLoading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--text-muted)" }}>
            <span className="spinner" /> Loading open jobs...
          </div>
        ) : openJobIds.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>📋</div>
            <p>No open jobs right now.</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
              Post the first job
            </Link>
          </div>
        ) : (
          <div className="grid-2">
            {openJobIds.map((id) => (
              <JobCard key={String(id)} jobId={id} wallet={wallet} showRole={false} />
            ))}
          </div>
        )
      )}

      {/* My jobs */}
      {(tab === "client" || tab === "freelancer") && (
        loading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "var(--text-muted)" }}>
            <span className="spinner" /> Loading...
          </div>
        ) : myIds.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>📋</div>
            <p>No jobs yet as {tab}.</p>
            {tab === "client" && (
              <Link to="/create" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
                Post your first job
              </Link>
            )}
            {tab === "freelancer" && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setTab("browse")}>
                Browse open jobs
              </button>
            )}
          </div>
        ) : (
          <div className="grid-2">
            {myIds.map((id) => (
              <JobCard key={String(id)} jobId={id} wallet={wallet} showRole={true} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
