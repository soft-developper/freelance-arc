import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { formatUSDC, JOB_STATUS, shortAddr, CONTRACTS } from "../utils/arc";
import { ethers } from "ethers";
import { ESCROW_ABI } from "../abi";

function JobCard({ jobId, wallet, showRole }) {
  const { getJob } = useEscrow(wallet.signer);
  const [job, setJob] = useState(null);

  useEffect(() => {
    getJob(jobId).then(setJob).catch(() => {});
  }, [jobId]);

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
          <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#7a8099" }}>JOB #{String(jobId)}</span>
          <span className={"badge badge-" + statusLabel.toLowerCase()}>{statusLabel}</span>
        </div>
        <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>{job.title}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatUSDC(job.totalAmount)} USDC</span>
          {showRole && (
            <span style={{
              fontSize: "0.72rem",
              color: isClient ? "#2775CA" : "#00d4aa",
              background: isClient ? "rgba(39,117,202,0.1)" : "rgba(0,212,170,0.1)",
              padding: "2px 8px", borderRadius: 4,
            }}>
              {isClient ? "CLIENT" : "FREELANCER"}
            </span>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: "0.75rem", color: "#7a8099" }}>
          Posted by: <span className="addr">{shortAddr(job.client)}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: "0.72rem", color: "#4a5068" }}>
          {new Date(Number(job.createdAt) * 1000).toLocaleDateString()}
        </div>
        {statusLabel === "Open" && !isClient && (
          <div style={{
            marginTop: 10,
            padding: "6px 12px",
            background: "rgba(0,212,170,0.1)",
            border: "1px solid rgba(0,212,170,0.3)",
            borderRadius: 6,
            fontSize: "0.78rem",
            color: "#00d4aa",
            textAlign: "center",
          }}>
            Click to Accept this Job
          </div>
        )}
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

  // Load my jobs
  useEffect(() => {
    if (!wallet.address) return;
    setLoading(true);
    Promise.all([
      getClientJobs(wallet.address),
      getFreelancerJobs(wallet.address),
      getUSDCBalance(wallet.address),
    ]).then(([cj, fj, bal]) => {
      setClientIds([...cj].reverse());
      setFreelancerIds([...fj].reverse());
      setBalance(bal);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [wallet.address]);

  // Load all open jobs
  useEffect(() => {
    if (!wallet.signer) return;
    setBrowseLoading(true);

    async function loadOpenJobs() {
      try {
        const provider = wallet.signer.provider;
        const contract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
        const total = await contract.getTotalJobs();
        const totalNum = Number(total);

        const ids = [];
        // Check last 50 jobs max
        const start = Math.max(1, totalNum - 49);
        for (let i = totalNum; i >= start; i--) {
          ids.push(BigInt(i));
        }

        // Filter only Open jobs (status 0)
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
    }

    loadOpenJobs();
  }, [wallet.signer]);

  const myIds = tab === "client" ? clientIds : freelancerIds;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "#7a8099", fontSize: "0.875rem" }}>Browse open jobs or manage your work</p>
        </div>
        <Link to="/create" className="btn btn-primary">+ Post Job</Link>
      </div>

      {/* Balance */}
      {balance !== null && (
        <div className="card" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              USDC Balance
            </div>
            <div style={{ fontSize: "1.8rem", fontFamily: "monospace", fontWeight: 700 }}>
              {formatUSDC(balance)} <span style={{ fontSize: "0.9rem", color: "#2775CA" }}>USDC</span>
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
          { label: "Open Jobs Available", value: openJobIds.length   },
          { label: "My Client Jobs",      value: clientIds.length    },
          { label: "My Freelance Jobs",   value: freelancerIds.length },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: "1.8rem", fontFamily: "monospace", fontWeight: 700, color: "#00d4aa" }}>{s.value}</div>
            <div style={{ fontSize: "0.78rem", color: "#7a8099", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20, padding: 4,
        background: "#12141a", borderRadius: 8, width: "fit-content",
        border: "1px solid #1f2330",
      }}>
        {[
          { key: "browse",     label: "Browse Open Jobs (" + openJobIds.length + ")" },
          { key: "client",     label: "My Client Jobs (" + clientIds.length + ")"    },
          { key: "freelancer", label: "My Freelance Jobs (" + freelancerIds.length + ")" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 16px", borderRadius: 6, border: "none",
            background: tab === t.key ? "#1a1d26" : "transparent",
            color: tab === t.key ? "#e8eaf0" : "#7a8099",
            cursor: "pointer", fontSize: "0.82rem",
            fontWeight: tab === t.key ? 500 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Browse open jobs */}
      {tab === "browse" && (
        browseLoading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#7a8099" }}>
            <span className="spinner" /> Loading open jobs...
          </div>
        ) : openJobIds.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "#7a8099" }}>
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

      {/* My client or freelancer jobs */}
      {(tab === "client" || tab === "freelancer") && (
        loading ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#7a8099" }}>
            <span className="spinner" /> Loading...
          </div>
        ) : myIds.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "#7a8099" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>📋</div>
            <p>No jobs yet as {tab}.</p>
            {tab === "client" && (
              <Link to="/create" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
                Post your first job
              </Link>
            )}
            {tab === "freelancer" && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => setTab("browse")}
              >
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
