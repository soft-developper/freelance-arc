import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { formatUSDC, shortAddr, ARC_TESTNET, CONTRACTS } from "../utils/arc";
import { getCategoryById } from "../utils/categories";
import { ethers } from "ethers";
import { ESCROW_ABI } from "../abi";

const JOB_STATUS = { 0: "Open", 1: "Active", 2: "Completed", 3: "Disputed", 4: "Cancelled" };
const MS_STATUS  = { 0: "Pending", 1: "Submitted", 2: "Approved", 3: "Disputed" };
const MS_COLOR   = { 0: "var(--text-dim)", 1: "#a855f7", 2: "var(--success)", 3: "var(--error)" };

function parseJobMeta(descriptionHash) {
  try { return JSON.parse(descriptionHash); } catch { return null; }
}

export default function JobDetail({ wallet }) {
  const { jobId } = useParams();
  const navigate  = useNavigate();
  const { getJob, expireJob, loading, txHash, error } = useEscrow(wallet.signer);

  const [job, setJob]                           = useState(null);
  const [fetchError, setFetchError]             = useState(null);
  const [refresh, setRefresh]                   = useState(0);
  const [disputeMessages, setDisputeMessages]   = useState([]);
  const [chatMsg, setChatMsg]                   = useState("");
  const [disputeReason, setDisputeReason]       = useState("");
  const [splitPercent, setSplitPercent]         = useState(50);
  const [actionLoading, setActionLoading]       = useState(false);
  const [actionError, setActionError]           = useState(null);
  const [actionTx, setActionTx]                 = useState(null);
  const [milestoneInputs, setMilestoneInputs]   = useState({});
  const [revisionInputs, setRevisionInputs]     = useState({});
  const [showRevision, setShowRevision]         = useState({});

  const isClient     = job?.client?.toLowerCase()     === wallet.address?.toLowerCase();
  const isFreelancer = job?.freelancer?.toLowerCase() === wallet.address?.toLowerCase();
  const statusLabel  = job ? (JOB_STATUS[Number(job.status)] || "Unknown") : "";
  const noFreelancer = job?.freelancer === "0x0000000000000000000000000000000000000000";
  const hasSplitProposal = job?.clientSplitPercent > 0n;

  const hasDeadline           = job?.deadlineDuration > 0n;
  const deadlineDate          = hasDeadline && job?.acceptedAt > 0n
    ? new Date((Number(job.acceptedAt) + Number(job.deadlineDuration)) * 1000)
    : null;
  const deadlinePassed        = deadlineDate && Date.now() > deadlineDate.getTime();
  const anyMilestoneSubmitted = job?.milestones?.some((ms) => Number(ms.status) !== 0);

  const pendingMilestones = job?.milestones?.filter((ms) => Number(ms.status) !== 2) || [];
  const meta     = job ? parseJobMeta(job.descriptionHash) : null;
  const category = meta ? getCategoryById(meta.category) : null;

  // Auto refresh job every 5 seconds
  useEffect(() => {
    if (!jobId || !wallet.signer) return;
    function fetchJob() {
      getJob(BigInt(jobId))
        .then((data) => {
          if (!data) setFetchError("Job not found on chain");
          else { setJob(data); setFetchError(null); }
        })
        .catch((e) => setFetchError(e.message));
    }
    setJob(null);
    fetchJob();
    const interval = setInterval(fetchJob, 5000);
    return () => clearInterval(interval);
  }, [jobId, refresh, wallet.signer]);

  // Auto refresh dispute messages every 5 seconds
  useEffect(() => {
    if (!wallet.signer || !job || Number(job.status) !== 3) return;
    async function loadMessages() {
      try {
        const provider = wallet.signer.provider;
        const contract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
        const filter   = contract.filters.DisputeMessage(BigInt(jobId));
        const events   = await contract.queryFilter(filter, -10000);
        setDisputeMessages(events.map((e) => ({
          sender:    e.args.sender,
          message:   e.args.message,
          timestamp: Number(e.args.timestamp),
        })));
      } catch (e) {
        console.error("Load messages error:", e.message);
      }
    }
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [job?.status, refresh]);

  const act = async (fn) => {
    setActionLoading(true);
    setActionError(null);
    setActionTx(null);
    try {
      const contract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, wallet.signer);
      const tx = await fn(contract);
      setActionTx(tx.hash);
      await tx.wait();
      setRefresh((r) => r + 1);
    } catch (e) {
      setActionError(e?.reason || e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (fetchError) return (
    <div style={{ padding: 32 }}>
      <div className="alert alert-error" style={{ marginBottom: 16 }}>Failed to load job: {fetchError}</div>
      <a href="/dashboard" style={{ color: "var(--primary)" }}>Go back to Dashboard</a>
    </div>
  );

  if (!job) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, color: "var(--text-muted)", padding: 32 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="spinner" /> Loading job #{jobId}...
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
        If this takes more than 5 seconds, the job ID may not exist.
        <br />
        <a href="/dashboard" style={{ color: "var(--primary)" }}>Go back to Dashboard</a>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.875rem", marginBottom: 16 }}
      >
        Back to Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>JOB #{jobId}</div>
          <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>{job.title}</h1>
          {/* Category badge */}
          {category && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--primary)", background: "var(--arc-dim)", padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(14,165,233,0.2)" }}>
                {category.icon} {category.label}
              </span>
              {meta?.subcategory && (
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  {meta.subcategory}
                </span>
              )}
            </div>
          )}
        </div>
        <span className={"badge badge-" + statusLabel.toLowerCase()} style={{ fontSize: "0.8rem", padding: "5px 14px", flexShrink: 0, marginLeft: 12 }}>
          {statusLabel}
        </span>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {(txHash || actionTx) && (
        <div className="alert alert-success">
          Done!{" "}
          <a href={ARC_TESTNET.explorer + "/tx/" + (actionTx || txHash)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>
            View on Explorer
          </a>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Job Details */}
        <div className="card">
          <h3 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Client</div>
              <span className="addr">{shortAddr(job.client)}</span>
              {isClient && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "var(--usdc)" }}>(you)</span>}
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Freelancer</div>
              {noFreelancer ? <span style={{ color: "var(--text-dim)" }}>None yet</span> : <span className="addr">{shortAddr(job.freelancer)}</span>}
              {isFreelancer && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "var(--primary)" }}>(you)</span>}
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Total Amount</div>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatUSDC(job.totalAmount)} USDC</span>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Created</div>
              <span style={{ fontSize: "0.85rem" }}>{new Date(Number(job.createdAt) * 1000).toLocaleString()}</span>
            </div>

            {/* Deadline */}
            {hasDeadline && (
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 2 }}>Deadline</div>
                {job.acceptedAt > 0n ? (
                  <span style={{
                    fontSize: "0.85rem",
                    color: deadlinePassed ? "var(--error)" : "var(--warning)",
                    fontWeight: 600,
                  }}>
                    {deadlinePassed ? "⚠ Expired — " : "⏱ "}{deadlineDate?.toLocaleDateString()}
                  </span>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {Number(job.deadlineDuration) / 86400} days after acceptance
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {meta?.description && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Description</div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.7 }}>{meta.description}</p>
            </div>
          )}

          {/* Skills */}
          {meta?.skills?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8 }}>Required Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {meta.skills.map((skill) => (
                  <span key={skill} style={{
                    padding: "4px 10px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 500,
                    background: "var(--arc-dim)", color: "var(--primary)",
                    border: "1px solid rgba(14,165,233,0.2)",
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          {meta?.contact && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 6 }}>Contact Client</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.72rem", padding: "2px 10px", borderRadius: 4, background: "var(--arc-dim)", color: "var(--primary)", textTransform: "capitalize", border: "1px solid rgba(14,165,233,0.2)" }}>
                  {meta.contactType || "contact"}
                </span>
                <span style={{ fontSize: "0.875rem", fontFamily: "monospace", color: "var(--text)" }}>{meta.contact}</span>
              </div>
            </div>
          )}
        </div>

        {/* Milestones */}
        {job.milestones?.length > 0 && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Milestones</h3>
              {isClient && Number(job.status) === 1 && pendingMilestones.length > 0 && (
                <button className="btn btn-primary btn-sm" onClick={() => act((c) => c.approveAllMilestones(BigInt(jobId)))} disabled={actionLoading}>
                  Release All Remaining USDC
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {job.milestones.map((ms, i) => {
                const msStatus    = Number(ms.status);
                const statusText  = MS_STATUS[msStatus] || "Unknown";
                const statusColor = MS_COLOR[msStatus] || "var(--text-dim)";
                const timeoutPassed = ms.submittedAt > 0n && Date.now() / 1000 > Number(ms.submittedAt) + 7 * 24 * 3600;

                return (
                  <div key={i} style={{
                    background: "var(--bg-elevated)", borderRadius: 10, padding: 16,
                    border: "1px solid " + (msStatus === 2 ? "rgba(16,185,129,0.3)" : msStatus === 1 ? "rgba(168,85,247,0.3)" : "var(--border)"),
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.7rem", fontFamily: "monospace", flexShrink: 0,
                          background: msStatus === 2 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                          color: statusColor, border: "1px solid " + statusColor + "44",
                        }}>
                          {msStatus === 2 ? "✓" : i + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{ms.description}</div>
                          <div style={{ fontSize: "0.72rem", color: statusColor, marginTop: 2 }}>{statusText}</div>
                        </div>
                      </div>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" }}>{formatUSDC(ms.amount)} USDC</span>
                    </div>

                    {ms.deliverableHash && (
                      <div style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: 6, marginBottom: 10 }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginBottom: 2 }}>DELIVERABLE</div>
                        <span style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "var(--primary)" }}>{ms.deliverableHash}</span>
                      </div>
                    )}

                    {isFreelancer && Number(job.status) === 1 && msStatus === 0 && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <input className="input" placeholder="Paste deliverable link or IPFS hash..." value={milestoneInputs[i] || ""} onChange={(e) => setMilestoneInputs((prev) => ({ ...prev, [i]: e.target.value }))} style={{ fontSize: "0.82rem" }} />
                        <button className="btn btn-primary btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => act((c) => c.submitMilestone(BigInt(jobId), i, milestoneInputs[i] || ""))} disabled={actionLoading || !milestoneInputs[i]?.trim()}>
                          Submit
                        </button>
                      </div>
                    )}

                    {isClient && Number(job.status) === 1 && msStatus === 1 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => act((c) => c.approveMilestone(BigInt(jobId), i))} disabled={actionLoading}>
                            Approve and Release {formatUSDC(ms.amount)} USDC
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setShowRevision((prev) => ({ ...prev, [i]: !prev[i] }))}>
                            Request Revision
                          </button>
                        </div>
                        {showRevision[i] && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <input className="input" placeholder="Explain what needs to be changed..." value={revisionInputs[i] || ""} onChange={(e) => setRevisionInputs((prev) => ({ ...prev, [i]: e.target.value }))} style={{ fontSize: "0.82rem" }} />
                            <button className="btn btn-danger btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => { act((c) => c.requestMilestoneRevision(BigInt(jobId), i, revisionInputs[i] || "")); setShowRevision((prev) => ({ ...prev, [i]: false })); }} disabled={actionLoading || !revisionInputs[i]?.trim()}>
                              Send Back
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isFreelancer && msStatus === 1 && timeoutPassed && (
                      <div style={{ marginTop: 8 }}>
                        <div className="alert alert-info" style={{ marginBottom: 8, fontSize: "0.8rem" }}>Client has not responded in 7 days. You can claim this milestone.</div>
                        <button className="btn btn-primary btn-sm" onClick={() => act((c) => c.claimMilestoneAfterTimeout(BigInt(jobId), i))} disabled={actionLoading}>
                          Claim {formatUSDC(ms.amount)} USDC
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dispute Chat */}
        {Number(job.status) === 3 && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
            <h3 style={{ fontSize: "0.8rem", color: "var(--error)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Dispute Chat</h3>
            <div style={{ background: "var(--bg)", borderRadius: 8, padding: 16, minHeight: 120, maxHeight: 300, overflowY: "auto", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {disputeMessages.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", textAlign: "center" }}>No messages yet. Start the conversation.</p>
              ) : (
                disputeMessages.map((msg, i) => {
                  const isMe = msg.sender.toLowerCase() === wallet.address?.toLowerCase();
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ background: isMe ? "var(--arc-dim)" : "rgba(255,255,255,0.04)", border: "1px solid " + (isMe ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.08)"), borderRadius: 8, padding: "8px 12px", maxWidth: "80%" }}>
                        <div style={{ fontSize: "0.7rem", color: isMe ? "var(--primary)" : "var(--text-muted)", marginBottom: 4 }}>
                          {isMe ? "You" : shortAddr(msg.sender)} — {msg.sender.toLowerCase() === job.client.toLowerCase() ? "Client" : "Freelancer"}
                        </div>
                        <div style={{ fontSize: "0.875rem" }}>{msg.message}</div>
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: 2 }}>{new Date(msg.timestamp * 1000).toLocaleString()}</div>
                    </div>
                  );
                })
              )}
            </div>

            {(isClient || isFreelancer) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input className="input" placeholder="Type a message..." value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && chatMsg.trim()) { act((c) => c.addDisputeMessage(BigInt(jobId), chatMsg)); setChatMsg(""); } }} />
                <button className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => { if (!chatMsg.trim()) return; act((c) => c.addDisputeMessage(BigInt(jobId), chatMsg)); setChatMsg(""); }} disabled={actionLoading || !chatMsg.trim()}>
                  Send
                </button>
              </div>
            )}

            <hr className="divider" />
            <h4 style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Resolution Options</h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isClient && (
                <div style={{ padding: 14, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "var(--success)" }}>Release All Remaining USDC</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>Satisfied after discussion? Release all remaining funds to freelancer.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => act((c) => c.approveAllMilestones(BigInt(jobId)))} disabled={actionLoading}>Approve and Release All</button>
                </div>
              )}

              {isClient && (
                <div style={{ padding: 14, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "var(--warning)" }}>Propose Split Payment</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>Freelancer gets {splitPercent}% of remaining — you get back {100 - splitPercent}%</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Freelancer gets:</span>
                    <input type="range" min="10" max="90" step="5" value={splitPercent} onChange={(e) => setSplitPercent(Number(e.target.value))} style={{ flex: 1 }} />
                    <span style={{ fontFamily: "monospace", color: "var(--warning)", minWidth: 40 }}>{splitPercent}%</span>
                  </div>
                  <button className="btn btn-sm" style={{ background: "rgba(245,158,11,0.1)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.3)" }} onClick={() => act((c) => c.proposeSplit(BigInt(jobId), splitPercent))} disabled={actionLoading}>
                    Propose This Split
                  </button>
                </div>
              )}

              {isFreelancer && hasSplitProposal && (
                <div style={{ padding: 14, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "var(--warning)" }}>Split Payment Proposed</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>
                    Client proposes you receive {100 - Number(job.clientSplitPercent)}% of remaining funds.
                  </p>
                  <button className="btn btn-sm" style={{ background: "rgba(245,158,11,0.1)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.3)" }} onClick={() => act((c) => c.acceptSplit(BigInt(jobId)))} disabled={actionLoading}>
                    Accept Split
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="card">
          <h3 style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Actions</h3>

          {!isClient && !isFreelancer && Number(job.status) === 0 && (
            <div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 12 }}>
                Funds are locked in escrow. Accept this job to start working on the milestones.
              </p>
              {meta?.contact && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--arc-dim)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>Contact client before accepting</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.72rem", padding: "2px 10px", borderRadius: 4, background: "rgba(14,165,233,0.15)", color: "var(--primary)", textTransform: "capitalize", border: "1px solid rgba(14,165,233,0.2)" }}>
                      {meta.contactType || "contact"}
                    </span>
                    <span style={{ fontSize: "0.875rem", fontFamily: "monospace" }}>{meta.contact}</span>
                  </div>
                </div>
              )}
              <button className="btn btn-primary" onClick={() => act((c) => c.acceptJob(BigInt(jobId)))} disabled={actionLoading}>
                {actionLoading ? <><span className="spinner" /> Processing...</> : "Accept Job"}
              </button>
            </div>
          )}

          {/* Expire job — shown to anyone when deadline has passed and no work submitted */}
          {hasDeadline && deadlinePassed && !anyMilestoneSubmitted && Number(job.status) === 1 && (
            <div style={{ padding: 14, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "var(--error)" }}>Deadline Passed</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>
                The freelancer missed the deadline without submitting any work. Anyone can reset this job back to Open.
              </p>
              <button className="btn btn-danger btn-sm" onClick={() => act((c) => c.expireJob(BigInt(jobId)))} disabled={actionLoading}>
                Expire Job & Reset to Open
              </button>
            </div>
          )}

          {isFreelancer && Number(job.status) === 1 && (
            <div className="alert alert-info">Submit each milestone above as you complete it. The client will review and release payment per milestone.</div>
          )}

          {isClient && Number(job.status) === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="alert alert-info">Review each submitted milestone above and approve or request revision.</div>
              {pendingMilestones.length > 0 && (
                <div style={{ padding: 14, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "var(--error)" }}>Raise a Dispute</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>Use this only if you cannot resolve the issue through milestone revisions.</p>
                  <textarea className="textarea" placeholder="Explain the issue..." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} style={{ minHeight: 70, marginBottom: 10 }} />
                  <button className="btn btn-danger btn-sm" onClick={() => act((c) => c.raiseDispute(BigInt(jobId), disputeReason))} disabled={actionLoading || !disputeReason.trim()}>
                    Raise Dispute
                  </button>
                </div>
              )}
            </div>
          )}

          {isClient && Number(job.status) === 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => act((c) => c.cancelJob(BigInt(jobId)))} disabled={actionLoading}>
              Cancel and Refund
            </button>
          )}

          {Number(job.status) === 2 && <div className="alert alert-success">Job completed. All milestones approved and USDC released to freelancer.</div>}
          {Number(job.status) === 4 && <div className="alert alert-error">This job was cancelled.</div>}
        </div>

      </div>
    </div>
  );
}
