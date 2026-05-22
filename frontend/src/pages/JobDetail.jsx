import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { formatUSDC, JOB_STATUS, shortAddr, ARC_TESTNET, CONTRACTS } from "../utils/arc";
import { ethers } from "ethers";
import { ESCROW_ABI } from "../abi";

const JOB_STATUS_EXTENDED = {
  0: "Open",
  1: "Active",
  2: "Submitted",
  3: "Completed",
  4: "Disputed",
  5: "Refunded",
  6: "Cancelled",
  7: "Revision",
};

export default function JobDetail({ wallet }) {
  const { jobId } = useParams();
  const navigate  = useNavigate();
  const { getJob, loading, txHash, error } = useEscrow(wallet.signer);

  const [job, setJob]                           = useState(null);
  const [fetchError, setFetchError]             = useState(null);
  const [deliverableHash, setDeliverableHash]   = useState("");
  const [refresh, setRefresh]                   = useState(0);
  const [disputeMessages, setDisputeMessages]   = useState([]);
  const [chatMsg, setChatMsg]                   = useState("");
  const [disputeReason, setDisputeReason]       = useState("");
  const [splitPercent, setSplitPercent]         = useState(50);
  const [actionLoading, setActionLoading]       = useState(false);
  const [actionError, setActionError]           = useState(null);
  const [actionTx, setActionTx]                 = useState(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const isClient     = job?.client?.toLowerCase()     === wallet.address?.toLowerCase();
  const isFreelancer = job?.freelancer?.toLowerCase() === wallet.address?.toLowerCase();
  const statusLabel  = job ? (JOB_STATUS_EXTENDED[Number(job.status)] || "Unknown") : "";
  const noFreelancer = job?.freelancer === "0x0000000000000000000000000000000000000000";
  const timeoutPassed = job?.submittedAt > 0n && Date.now() / 1000 > Number(job.submittedAt) + 7 * 24 * 3600;
  const hasSplitProposal = job?.clientSplitPercent > 0n;

  // Auto refresh job every 5 seconds
  useEffect(() => {
    if (!jobId || !wallet.signer) return;

    function fetchJob() {
      getJob(BigInt(jobId))
        .then((data) => {
          if (!data) setFetchError("Job not found on chain");
          else {
            setJob(data);
            setFetchError(null);
          }
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
    if (!wallet.signer || !job || Number(job.status) !== 4) return;

    async function loadMessages() {
      try {
        const provider = wallet.signer.provider;
        const contract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
        const filter   = contract.filters.DisputeMessage(BigInt(jobId));
        const events   = await contract.queryFilter(filter, -10000);
        const msgs = events.map((e) => ({
          sender:    e.args.sender,
          message:   e.args.message,
          timestamp: Number(e.args.timestamp),
        }));
        setDisputeMessages(msgs);
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
      <a href="/dashboard" style={{ color: "#00d4aa" }}>Go back to Dashboard</a>
    </div>
  );

  if (!job) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, color: "#7a8099", padding: 32 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="spinner" /> Loading job #{jobId}...
      </div>
      <div style={{ fontSize: "0.8rem", color: "#4a5068" }}>
        If this takes more than 5 seconds, the job ID may not exist.
        <br />
        <a href="/dashboard" style={{ color: "#00d4aa" }}>Go back to Dashboard</a>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", color: "#7a8099", cursor: "pointer", fontSize: "0.875rem", marginBottom: 16 }}
      >
        Back to Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#7a8099", marginBottom: 4 }}>JOB #{jobId}</div>
          <h1 style={{ fontSize: "1.6rem" }}>{job.title}</h1>
        </div>
        <span className={"badge badge-" + statusLabel.toLowerCase()} style={{ fontSize: "0.8rem", padding: "5px 14px" }}>
          {statusLabel}
        </span>
      </div>

      {actionError && <div className="alert alert-error">{actionError}</div>}
      {(txHash || actionTx) && (
        <div className="alert alert-success">
          Done!{" "}
          <a href={ARC_TESTNET.explorer + "/tx/" + (actionTx || txHash)} target="_blank" rel="noopener noreferrer" style={{ color: "#00d4aa" }}>
            View on Explorer
          </a>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Job Details */}
        <div className="card">
          <h3 style={{ fontSize: "0.8rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Client</div>
              <span className="addr">{shortAddr(job.client)}</span>
              {isClient && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#2775CA" }}>(you)</span>}
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Freelancer</div>
              {noFreelancer
                ? <span style={{ color: "#4a5068" }}>None yet</span>
                : <span className="addr">{shortAddr(job.freelancer)}</span>
              }
              {isFreelancer && <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#00d4aa" }}>(you)</span>}
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Amount</div>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatUSDC(job.totalAmount)} USDC</span>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Platform Fee</div>
              <span style={{ fontFamily: "monospace", color: "#7a8099" }}>{formatUSDC(job.platformFee)} USDC</span>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Created</div>
              <span style={{ fontSize: "0.85rem" }}>{new Date(Number(job.createdAt) * 1000).toLocaleString()}</span>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", textTransform: "uppercase", marginBottom: 2 }}>Submitted</div>
              <span style={{ fontSize: "0.85rem" }}>{job.submittedAt > 0n ? new Date(Number(job.submittedAt) * 1000).toLocaleString() : "Not yet"}</span>
            </div>
          </div>

          {job.deliverableHash && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#1a1d26", borderRadius: 6 }}>
              <div style={{ fontSize: "0.72rem", color: "#4a5068", marginBottom: 2 }}>DELIVERABLE HASH</div>
              <span style={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all", color: "#00d4aa" }}>
                {job.deliverableHash}
              </span>
            </div>
          )}
        </div>

        {/* Milestones */}
        {job.milestones?.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: "0.8rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Milestones</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {job.milestones.map((ms, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", background: "#1a1d26", borderRadius: 6,
                  border: "1px solid " + (ms.released ? "rgba(16,185,129,0.3)" : "#1f2330"),
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: "0.65rem",
                      fontFamily: "monospace",
                      background: ms.released ? "rgba(16,185,129,0.15)" : "#0a0b0f",
                      color: ms.released ? "#10b981" : "#4a5068",
                      border: "1px solid " + (ms.released ? "rgba(16,185,129,0.4)" : "#1f2330"),
                    }}>
                      {ms.released ? "✓" : i + 1}
                    </span>
                    <span style={{ fontSize: "0.875rem" }}>{ms.description}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{formatUSDC(ms.amount)} USDC</span>
                    {isClient && !ms.released && Number(job.status) === 1 && (
                      <button
                        className="btn btn-sm"
                        style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
                        onClick={() => act((c) => c.releaseMilestone(BigInt(jobId), i))}
                        disabled={actionLoading}
                      >
                        Release
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dispute Chat */}
        {Number(job.status) === 4 && (
          <div className="card" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
            <h3 style={{ fontSize: "0.8rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              Dispute Chat
            </h3>

            <div style={{
              background: "#0a0b0f", borderRadius: 8, padding: 16,
              minHeight: 120, maxHeight: 300, overflowY: "auto",
              marginBottom: 16, display: "flex", flexDirection: "column", gap: 10,
            }}>
              {disputeMessages.length === 0 ? (
                <p style={{ color: "#4a5068", fontSize: "0.82rem", textAlign: "center" }}>
                  No messages yet. Start the conversation.
                </p>
              ) : (
                disputeMessages.map((msg, i) => {
                  const isMe = msg.sender.toLowerCase() === wallet.address?.toLowerCase();
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{
                        background: isMe ? "rgba(0,212,170,0.15)" : "rgba(255,255,255,0.05)",
                        border: "1px solid " + (isMe ? "rgba(0,212,170,0.3)" : "rgba(255,255,255,0.08)"),
                        borderRadius: 8, padding: "8px 12px", maxWidth: "80%",
                      }}>
                        <div style={{ fontSize: "0.7rem", color: isMe ? "#00d4aa" : "#7a8099", marginBottom: 4 }}>
                          {isMe ? "You" : shortAddr(msg.sender)}
                          {" — "}
                          {msg.sender.toLowerCase() === job.client.toLowerCase() ? "Client" : "Freelancer"}
                        </div>
                        <div style={{ fontSize: "0.875rem" }}>{msg.message}</div>
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "#4a5068", marginTop: 2 }}>
                        {new Date(msg.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {(isClient || isFreelancer) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  className="input"
                  placeholder="Type a message..."
                  value={chatMsg}
                  onChange={(e) => setChatMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chatMsg.trim()) {
                      act((c) => c.addDisputeMessage(BigInt(jobId), chatMsg));
                      setChatMsg("");
                    }
                  }}
                />
                <button
                  className="btn btn-secondary"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    if (!chatMsg.trim()) return;
                    act((c) => c.addDisputeMessage(BigInt(jobId), chatMsg));
                    setChatMsg("");
                  }}
                  disabled={actionLoading || !chatMsg.trim()}
                >
                  Send
                </button>
              </div>
            )}

            <hr className="divider" />

            <h4 style={{ fontSize: "0.78rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Resolution Options
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {isClient && (
                <div style={{ padding: 14, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "#10b981" }}>Approve Work</div>
                  <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 10 }}>Satisfied after discussion? Release full USDC to freelancer.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => act((c) => c.approveDeliverable(BigInt(jobId)))} disabled={actionLoading}>
                    Approve and Release Full USDC
                  </button>
                </div>
              )}

              {isClient && (
                <div style={{ padding: 14, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "#3b82f6" }}>Request Revision</div>
                  <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 10 }}>Send job back so freelancer can resubmit improved work.</p>
                  <textarea
                    className="textarea"
                    placeholder="Explain what needs to be changed..."
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    style={{ minHeight: 70, marginBottom: 10 }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => act((c) => c.requestRevision(BigInt(jobId), revisionFeedback))}
                    disabled={actionLoading || !revisionFeedback.trim()}
                  >
                    Send Back for Revision
                  </button>
                </div>
              )}

              {isClient && (
                <div style={{ padding: 14, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "#f59e0b" }}>Propose Split Payment</div>
                  <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 10 }}>
                    Freelancer gets {splitPercent}% — you get back {100 - splitPercent}%
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.8rem", color: "#7a8099" }}>Freelancer gets:</span>
                    <input
                      type="range" min="10" max="90" step="5"
                      value={splitPercent}
                      onChange={(e) => setSplitPercent(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontFamily: "monospace", color: "#f59e0b", minWidth: 40 }}>{splitPercent}%</span>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                    onClick={() => act((c) => c.proposeSplit(BigInt(jobId), splitPercent))}
                    disabled={actionLoading}
                  >
                    Propose This Split
                  </button>
                </div>
              )}

              {isFreelancer && hasSplitProposal && (
                <div style={{ padding: 14, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4, color: "#f59e0b" }}>Split Payment Proposed</div>
                  <p style={{ fontSize: "0.8rem", color: "#7a8099", marginBottom: 4 }}>
                    Client proposes: You receive {100 - Number(job.clientSplitPercent)}% of the total.
                  </p>
                  <button
                    className="btn btn-sm"
                    style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                    onClick={() => act((c) => c.acceptSplit(BigInt(jobId)))}
                    disabled={actionLoading}
                  >
                    Accept Split
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Normal Actions */}
        <div className="card">
          <h3 style={{ fontSize: "0.8rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Actions</h3>

          {!isClient && !isFreelancer && Number(job.status) === 0 && (
            <div>
              <p style={{ fontSize: "0.875rem", color: "#7a8099", marginBottom: 12 }}>Funds are locked in escrow. Accept this job to start working.</p>
              <button className="btn btn-primary" onClick={() => act((c) => c.acceptJob(BigInt(jobId)))} disabled={actionLoading}>
                {actionLoading ? <><span className="spinner" /> Processing...</> : "Accept Job"}
              </button>
            </div>
          )}

          {isFreelancer && (Number(job.status) === 1 || Number(job.status) === 7) && (
            <div>
              <label className="label">{Number(job.status) === 7 ? "Resubmit Deliverable Hash" : "Deliverable Hash"}</label>
              {Number(job.status) === 7 && (
                <div className="alert alert-info" style={{ marginBottom: 10 }}>Client requested a revision. Submit your updated work.</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  placeholder="QmYourIPFSHash..."
                  value={deliverableHash}
                  onChange={(e) => setDeliverableHash(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => act((c) => c.submitDeliverable(BigInt(jobId), deliverableHash))}
                  disabled={actionLoading || !deliverableHash.trim()}
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {isClient && Number(job.status) === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn btn-primary" onClick={() => act((c) => c.approveDeliverable(BigInt(jobId)))} disabled={actionLoading}>
                {actionLoading ? <><span className="spinner" /> Processing...</> : "Approve and Release USDC"}
              </button>
              <div style={{ padding: 14, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "#ef4444" }}>Not satisfied?</div>
                <textarea
                  className="textarea"
                  placeholder="Explain the issue to start a dispute..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  style={{ minHeight: 70, marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => act((c) => c.raiseDispute(BigInt(jobId), disputeReason))}
                    disabled={actionLoading || !disputeReason.trim()}
                  >
                    Raise Dispute
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => act((c) => c.requestRevision(BigInt(jobId), disputeReason))}
                    disabled={actionLoading || !disputeReason.trim()}
                  >
                    Request Revision Only
                  </button>
                </div>
              </div>
            </div>
          )}

          {isClient && Number(job.status) === 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => act((c) => c.cancelJob(BigInt(jobId)))} disabled={actionLoading}>
              Cancel and Refund
            </button>
          )}

          {isFreelancer && Number(job.status) === 2 && timeoutPassed && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: 10 }}>Client has not responded in 7 days. You can claim your payment.</div>
              <button className="btn btn-primary" onClick={() => act((c) => c.claimAfterTimeout(BigInt(jobId)))} disabled={actionLoading}>
                Claim Payment
              </button>
            </div>
          )}

          {Number(job.status) === 3 && <div className="alert alert-success">Job completed. USDC has been released to the freelancer.</div>}
          {Number(job.status) === 6 && <div className="alert alert-error">This job was cancelled.</div>}
          {Number(job.status) === 7 && !isFreelancer && <div className="alert alert-info">Waiting for freelancer to resubmit revised work.</div>}
        </div>

      </div>
    </div>
  );
}
