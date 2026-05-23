import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { CONTRACTS, formatUSDC, shortAddr, ARC_TESTNET } from "../utils/arc";
import { ESCROW_ABI } from "../abi";

const JOB_STATUS  = { 0: "Open", 1: "Active", 2: "Completed", 3: "Disputed", 4: "Cancelled" };
const MS_STATUS   = { 0: "Pending", 1: "Submitted", 2: "Approved", 3: "Disputed" };

export default function Admin({ wallet }) {
  const [stats, setStats]               = useState(null);
  const [allJobs, setAllJobs]           = useState([]);
  const [disputedJobs, setDisputedJobs] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]       = useState(null);
  const [newFee, setNewFee]             = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [disputeMessages, setDisputeMessages] = useState({});
  const [selectedJob, setSelectedJob]   = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const contract     = wallet.signer ? new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, wallet.signer) : null;
  const readContract = wallet.signer ? new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, wallet.signer.provider) : null;

  useEffect(() => {
    if (!wallet.signer) return;
    loadData();
  }, [wallet.signer]);

  async function loadData() {
    setLoading(true);
    try {
      const provider    = wallet.signer.provider;
      const rc          = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      const total       = await rc.getTotalJobs();
      const totalNum    = Number(total);

      let jobs = [];
      for (let i = 1; i <= totalNum; i++) {
        try {
          const job = await rc.getJob(BigInt(i));
          jobs.push({ ...job, jobId: i });
        } catch {}
      }

      setAllJobs(jobs);
      setDisputedJobs(jobs.filter((j) => Number(j.status) === 3));

      // Stats
      const totalUsdc  = jobs.reduce((s, j) => {
        const pending = j.milestones?.filter((m) => Number(m.status) !== 2).reduce((a, m) => a + BigInt(m.amount), 0n) || 0n;
        return s + pending;
      }, 0n);

      const completed  = jobs.filter((j) => Number(j.status) === 2).length;
      const disputed   = jobs.filter((j) => Number(j.status) === 3).length;
      const active     = jobs.filter((j) => Number(j.status) === 1).length;
      const open       = jobs.filter((j) => Number(j.status) === 0).length;

      setStats({ totalJobs: totalNum, completed, disputed, active, open, usdcInEscrow: totalUsdc });
    } catch (e) {
      console.error("loadData error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDisputeMessages(jobId) {
    try {
      const provider = wallet.signer.provider;
      const rc       = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      const filter   = rc.filters.DisputeMessage(BigInt(jobId));
      const events   = await rc.queryFilter(filter, -10000);
      setDisputeMessages((prev) => ({
        ...prev,
        [jobId]: events.map((e) => ({
          sender:    e.args.sender,
          message:   e.args.message,
          timestamp: Number(e.args.timestamp),
        })),
      }));
    } catch (e) {
      console.error("loadDisputeMessages error:", e.message);
    }
  }

  const act = async (fn, successMsg) => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      const tx = await fn();
      await tx.wait();
      setActionMsg({ type: "success", text: successMsg || "Done!" });
      await loadData();
    } catch (e) {
      setActionMsg({ type: "error", text: e?.reason || e?.shortMessage || e?.message || "Failed" });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredJobs = filterStatus === "all"
    ? allJobs
    : allJobs.filter((j) => Number(j.status) === Number(filterStatus));

  if (loading) return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", color: "#7a8099", padding: 32 }}>
      <span className="spinner" /> Loading admin data...
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Admin Dashboard</h1>
          <p style={{ color: "#7a8099", fontSize: "0.875rem" }}>
            Connected as: <span className="addr">{shortAddr(wallet.address)}</span>
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>Refresh</button>
      </div>

      {actionMsg && (
        <div className={"alert " + (actionMsg.type === "success" ? "alert-success" : "alert-error")} style={{ marginBottom: 20 }}>
          {actionMsg.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Jobs",     value: stats.totalJobs,                   color: "#00d4aa" },
            { label: "Open",           value: stats.open,                         color: "#f59e0b" },
            { label: "Active",         value: stats.active,                       color: "#3b82f6" },
            { label: "Completed",      value: stats.completed,                    color: "#10b981" },
            { label: "Disputed",       value: stats.disputed,                     color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: "1.6rem", fontFamily: "monospace", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "0.75rem", color: "#7a8099", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="card" style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Total USDC in Escrow
            </div>
            <div style={{ fontSize: "2rem", fontFamily: "monospace", fontWeight: 700, color: "#2775CA" }}>
              {formatUSDC(stats.usdcInEscrow)} <span style={{ fontSize: "0.9rem" }}>USDC</span>
            </div>
          </div>
          <a href={ARC_TESTNET.explorer + "/address/" + CONTRACTS.ESCROW} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            View Contract
          </a>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, padding: 4, background: "#12141a", borderRadius: 8, width: "fit-content", border: "1px solid #1f2330" }}>
        {[
          { key: "overview",  label: "All Jobs"        },
          { key: "disputes",  label: "Disputes (" + (stats?.disputed || 0) + ")" },
          { key: "settings",  label: "Settings"        },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "7px 18px", borderRadius: 6, border: "none",
            background: tab === t.key ? "#1a1d26" : "transparent",
            color: tab === t.key ? (t.key === "disputes" ? "#ef4444" : "#e8eaf0") : "#7a8099",
            cursor: "pointer", fontSize: "0.82rem",
            fontWeight: tab === t.key ? 500 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* All Jobs Tab */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { value: "all", label: "All" },
              { value: "0",   label: "Open"      },
              { value: "1",   label: "Active"    },
              { value: "2",   label: "Completed" },
              { value: "3",   label: "Disputed"  },
              { value: "4",   label: "Cancelled" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterStatus(f.value)}
                className="btn btn-sm"
                style={{
                  background: filterStatus === f.value ? "rgba(0,212,170,0.15)" : "var(--bg-elevated, #1a1d26)",
                  color: filterStatus === f.value ? "#00d4aa" : "#7a8099",
                  border: "1px solid " + (filterStatus === f.value ? "rgba(0,212,170,0.3)" : "#2a3050"),
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "#7a8099" }}>No jobs found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{
                display: "grid", gridTemplateColumns: "60px 1fr 120px 120px 100px 80px",
                padding: "8px 16px", fontSize: "0.72rem", color: "#4a5068",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                <span>ID</span><span>Title</span><span>Client</span><span>Amount</span><span>Status</span><span>View</span>
              </div>
              {filteredJobs.map((job) => {
                const statusLabel = JOB_STATUS[Number(job.status)] || "Unknown";
                return (
                  <div key={job.jobId} className="card" style={{
                    display: "grid", gridTemplateColumns: "60px 1fr 120px 120px 100px 80px",
                    padding: "12px 16px", alignItems: "center", borderRadius: 8,
                    border: Number(job.status) === 3 ? "1px solid rgba(239,68,68,0.3)" : "1px solid #1f2330",
                  }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#7a8099" }}>#{job.jobId}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{job.title}</span>
                    <span className="addr">{shortAddr(job.client)}</span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{formatUSDC(job.totalAmount)} USDC</span>
                    <span className={"badge badge-" + statusLabel.toLowerCase()}>{statusLabel}</span>
                    <Link to={"/job/" + job.jobId} className="btn btn-secondary btn-sm">View</Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Disputes Tab */}
      {tab === "disputes" && (
        <div>
          {disputedJobs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "#7a8099" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>✅</div>
              <p>No active disputes. Everything is running smoothly.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {disputedJobs.map((job) => (
                <div key={job.jobId} className="card" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#7a8099", marginBottom: 4 }}>JOB #{job.jobId}</div>
                      <h3 style={{ fontSize: "1rem" }}>{job.title}</h3>
                    </div>
                    <span className="badge badge-disputed">Disputed</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 20px", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Client</div>
                      <span className="addr">{shortAddr(job.client)}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Freelancer</div>
                      <span className="addr">{shortAddr(job.freelancer)}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Total Amount</div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatUSDC(job.totalAmount)} USDC</span>
                    </div>
                  </div>

                  {/* Milestones summary */}
                  {job.milestones?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 8 }}>Milestones</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {job.milestones.map((ms, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1a1d26", borderRadius: 6, fontSize: "0.82rem" }}>
                            <span>{ms.description}</span>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontFamily: "monospace" }}>{formatUSDC(ms.amount)} USDC</span>
                              <span style={{ fontSize: "0.7rem", color: Number(ms.status) === 2 ? "#10b981" : "#7a8099" }}>
                                {MS_STATUS[Number(ms.status)]}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Load chat button */}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: 16 }}
                    onClick={() => {
                      setSelectedJob(selectedJob === job.jobId ? null : job.jobId);
                      if (selectedJob !== job.jobId) loadDisputeMessages(job.jobId);
                    }}
                  >
                    {selectedJob === job.jobId ? "Hide Chat" : "View Dispute Chat"}
                  </button>

                  {/* Chat messages */}
                  {selectedJob === job.jobId && disputeMessages[job.jobId] && (
                    <div style={{
                      background: "#0a0b0f", borderRadius: 8, padding: 14,
                      maxHeight: 250, overflowY: "auto", marginBottom: 16,
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      {disputeMessages[job.jobId].length === 0 ? (
                        <p style={{ color: "#4a5068", fontSize: "0.82rem" }}>No messages yet.</p>
                      ) : (
                        disputeMessages[job.jobId].map((msg, i) => {
                          const isClient = msg.sender.toLowerCase() === job.client.toLowerCase();
                          return (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isClient ? "flex-start" : "flex-end" }}>
                              <div style={{
                                background: isClient ? "rgba(39,117,202,0.15)" : "rgba(0,212,170,0.1)",
                                border: "1px solid " + (isClient ? "rgba(39,117,202,0.3)" : "rgba(0,212,170,0.2)"),
                                borderRadius: 8, padding: "8px 12px", maxWidth: "80%",
                              }}>
                                <div style={{ fontSize: "0.68rem", color: isClient ? "#2775CA" : "#00d4aa", marginBottom: 3 }}>
                                  {isClient ? "Client" : "Freelancer"} — {shortAddr(msg.sender)}
                                </div>
                                <div style={{ fontSize: "0.85rem" }}>{msg.message}</div>
                              </div>
                              <div style={{ fontSize: "0.62rem", color: "#4a5068", marginTop: 2 }}>
                                {new Date(msg.timestamp * 1000).toLocaleString()}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Admin resolution */}
                  <div style={{ padding: 16, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#ef4444", marginBottom: 12 }}>
                      Admin Resolution
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#7a8099", marginBottom: 14, lineHeight: 1.6 }}>
                      Admin can only intervene 7 days after the dispute was raised. Review the chat above before resolving.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", border: "1px solid rgba(0,212,170,0.3)" }}
                        onClick={() => act(
                          () => contract.resolveDispute(BigInt(job.jobId), job.freelancer, false),
                          "Resolved in favour of freelancer"
                        )}
                        disabled={actionLoading}
                      >
                        Pay Freelancer in Full
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: "rgba(39,117,202,0.1)", color: "#2775CA", border: "1px solid rgba(39,117,202,0.3)" }}
                        onClick={() => act(
                          () => contract.resolveDispute(BigInt(job.jobId), job.client, false),
                          "Resolved in favour of client"
                        )}
                        disabled={actionLoading}
                      >
                        Refund Client in Full
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                        onClick={() => act(
                          () => contract.resolveDispute(BigInt(job.jobId), job.client, true),
                          "Resolved with 50/50 split"
                        )}
                        disabled={actionLoading}
                      >
                        Split 50/50
                      </button>
                      <Link to={"/job/" + job.jobId} className="btn btn-secondary btn-sm">
                        View Full Job
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Update Platform Fee */}
          <div className="card">
            <h3 style={{ fontSize: "0.875rem", marginBottom: 4 }}>Platform Fee</h3>
            <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 16 }}>
              Current fee is charged on each milestone approval. Max 5%. Enter in basis points (100 = 1%).
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="number"
                placeholder="e.g. 100 for 1%"
                min="0"
                max="500"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => act(
                  () => contract.updatePlatformFee(BigInt(newFee)),
                  "Platform fee updated to " + newFee + " bps"
                )}
                disabled={actionLoading || !newFee}
              >
                Update Fee
              </button>
            </div>
          </div>

          {/* Update Fee Recipient */}
          <div className="card">
            <h3 style={{ fontSize: "0.875rem", marginBottom: 4 }}>Fee Recipient</h3>
            <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 16 }}>
              The wallet address that receives platform fees. Currently set to the deployer address.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="0x..."
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
                onClick={() => act(
                  () => contract.updateFeeRecipient(newRecipient),
                  "Fee recipient updated"
                )}
                disabled={actionLoading || !newRecipient}
              >
                Update
              </button>
            </div>
          </div>

          {/* Contract Info */}
          <div className="card">
            <h3 style={{ fontSize: "0.875rem", marginBottom: 14 }}>Contract Info</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Escrow Contract",    value: CONTRACTS.ESCROW,            link: ARC_TESTNET.explorer + "/address/" + CONTRACTS.ESCROW },
                { label: "Invoice Registry",   value: CONTRACTS.INVOICE_REGISTRY,  link: ARC_TESTNET.explorer + "/address/" + CONTRACTS.INVOICE_REGISTRY },
                { label: "USDC Contract",      value: CONTRACTS.USDC,              link: ARC_TESTNET.explorer + "/address/" + CONTRACTS.USDC },
              ].map(({ label, value, link }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#1a1d26", borderRadius: 6 }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                    <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{value}</span>
                  </div>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Explorer</a>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
