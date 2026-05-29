import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { generateJobDescription, generateMilestoneSplit } from "../hooks/useAgent";

export default function CreateJob({ wallet }) {
  const navigate = useNavigate();
  const { createJob, loading, txHash, error } = useEscrow(wallet.signer);

  const [form, setForm] = useState({
    title: "",
    description: "",
    contact: "",
    contactType: "email",
    milestones: [{ description: "", amount: "" }],
  });

  const [roughIdea, setRoughIdea]         = useState("");
  const [agentLoading, setAgentLoading]   = useState(false);
  const [agentError, setAgentError]       = useState(null);
  const [agentText, setAgentText]         = useState("");
  const [splitLoading, setSplitLoading]   = useState(false);
  const [totalBudget, setTotalBudget]     = useState("");
  const [showAgent, setShowAgent]         = useState(false);

  const total   = form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const fee     = total * 0.01;
  const deposit = total + fee;

  const addMilestone    = () => setForm((f) => ({ ...f, milestones: [...f.milestones, { description: "", amount: "" }] }));
  const removeMilestone = (i) => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }));
  const updateMilestone = (i, key, val) => setForm((f) => ({
    ...f, milestones: f.milestones.map((m, idx) => idx === i ? { ...m, [key]: val } : m),
  }));

  // Agent 1 — Generate full job from rough idea
  const handleGenerateJob = async () => {
    if (!roughIdea.trim()) return;
    setAgentLoading(true);
    setAgentError(null);
    setAgentText("");
    try {
      const fullText = await generateJobDescription(roughIdea, (chunk) => {
        setAgentText(chunk);
      });

      const clean = fullText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setForm({
  title:       parsed.title || "",
  description: parsed.description || "",
  contact:     form.contact,
  contactType: form.contactType,
  milestones:  parsed.milestones?.map((m) => ({
    description: m.description || "",
    amount:      String(parseFloat(m.amount) || ""),
  })) || [{ description: "", amount: "" }],
});
      setShowAgent(false);
      setAgentText("");
    } catch (e) {
      setAgentError("Agent failed: " + e.message);
    } finally {
      setAgentLoading(false);
    }
  };

  // Agent 3 — Smart milestone splitter
  const handleSplitMilestones = async () => {
    if (!form.title.trim() || !totalBudget) return;
    setSplitLoading(true);
    setAgentError(null);
    try {
      const result = await generateMilestoneSplit(form.title, form.description, totalBudget);
      setForm((f) => ({
  ...f,
  milestones: result.milestones.map((m) => ({
    description: m.description || "",
    amount:      String(parseFloat(m.amount) || ""),
  })),
}));
      setTotalBudget("");
    } catch (e) {
      setAgentError("Milestone split failed: " + e.message);
    } finally {
      setSplitLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return alert("Enter a job title");
    if (!form.contact.trim()) return alert("Enter a contact so freelancers can reach you");
    if (form.milestones.some((m) => !m.description.trim() || !m.amount)) {
      return alert("Fill all milestone fields");
    }
    try {
      const descHash = JSON.stringify({
        description: form.description,
        contact:     form.contact,
        contactType: form.contactType,
      });
      await createJob({ title: form.title, descHash, milestones: form.milestones });
      navigate("/dashboard");
    } catch {}
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 4 }}>Post a Job</h1>
        <p style={{ color: "#7a8099", fontSize: "0.875rem" }}>
          USDC is held in escrow and released when you approve the work.
        </p>
      </div>

      {error      && <div className="alert alert-error">{error}</div>}
      {agentError && <div className="alert alert-error">{agentError}</div>}
      {txHash     && (
        <div className="alert alert-success">
          Job created! Tx: <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{txHash}</span>
        </div>
      )}

      {/* AI Agent Box */}
      <div style={{
        marginBottom: 24,
        padding: 20,
        background: "rgba(0,212,170,0.04)",
        border: "1px solid rgba(0,212,170,0.2)",
        borderRadius: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(0,212,170,0.15)", border: "1px solid rgba(0,212,170,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.8rem",
          }}>
            AI
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>AI Job Assistant</div>
            <div style={{ fontSize: "0.75rem", color: "#7a8099" }}>
              Describe your idea in plain words — AI will write the full job post
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowAgent(!showAgent)}
          >
            {showAgent ? "Hide" : "Use AI"}
          </button>
        </div>

        {showAgent && (
          <div>
            <textarea
              className="textarea"
              placeholder='e.g. "I need someone to build a simple landing page for my SaaS product. It should look modern and have a hero section, features, pricing and footer. Budget around 150 USDC."'
              value={roughIdea}
              onChange={(e) => setRoughIdea(e.target.value)}
              style={{ minHeight: 90, marginBottom: 10 }}
            />

            {agentText && (
              <div style={{
                padding: "10px 14px",
                background: "#0a0b0f",
                borderRadius: 8,
                marginBottom: 10,
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#00d4aa",
                maxHeight: 120,
                overflowY: "auto",
              }}>
                {agentText}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleGenerateJob}
              disabled={agentLoading || !roughIdea.trim()}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {agentLoading
                ? <><span className="spinner" /> AI is writing your job post...</>
                : "Generate Job Post with AI"
              }
            </button>
          </div>
        )}
      </div>

      <div className="card">

        {/* Title */}
        <div className="form-group">
          <label className="label">Job Title *</label>
          <input
            className="input"
            placeholder="e.g. Build a landing page"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="label">Description</label>
          <textarea
            className="textarea"
            placeholder="Describe the project scope and requirements..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Contact */}
        <div className="form-group">
          <label className="label">Contact Me *</label>
          <p style={{ fontSize: "0.78rem", color: "#7a8099", marginBottom: 8 }}>
            Freelancers will use this to reach you about the job.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="input"
              style={{ width: 140, flexShrink: 0 }}
              value={form.contactType}
              onChange={(e) => setForm((f) => ({ ...f, contactType: e.target.value }))}
            >
              <option value="email">Email</option>
              <option value="github">GitHub</option>
              <option value="telegram">Telegram</option>
              <option value="twitter">Twitter / X</option>
              <option value="discord">Discord</option>
              <option value="other">Other</option>
            </select>
            <input
              className="input"
              placeholder={
                form.contactType === "email"    ? "you@example.com"      :
                form.contactType === "github"   ? "github.com/username"  :
                form.contactType === "telegram" ? "@yourusername"        :
                form.contactType === "twitter"  ? "@yourusername"        :
                form.contactType === "discord"  ? "username#0000"        :
                "Your contact info"
              }
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
          </div>
        </div>

        <hr className="divider" />

        {/* Milestones header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: "0.875rem", color: "#7a8099", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Milestones
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={addMilestone}>+ Add</button>
        </div>

        {/* AI Milestone Splitter */}
        <div style={{
          marginBottom: 16, padding: 14,
          background: "rgba(0,212,170,0.03)",
          border: "1px dashed rgba(0,212,170,0.2)",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: "0.78rem", color: "#7a8099", marginBottom: 8 }}>
            <span style={{ color: "#00d4aa", fontWeight: 600 }}>AI Milestone Splitter</span>
            {" — "}Enter your total budget and AI will suggest how to split it into fair milestones.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                className="input"
                type="number"
                placeholder="Total budget e.g. 150"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                style={{ paddingRight: 54 }}
              />
              <span style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: "0.72rem", color: "#2775CA", pointerEvents: "none",
              }}>
                USDC
              </span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: "nowrap" }}
              onClick={handleSplitMilestones}
              disabled={splitLoading || !totalBudget || !form.title.trim()}
            >
              {splitLoading ? <><span className="spinner" /> Splitting...</> : "AI Split"}
            </button>
          </div>
          {!form.title.trim() && (
            <div style={{ fontSize: "0.72rem", color: "#f59e0b", marginTop: 6 }}>
              Enter a job title first so AI knows the project type.
            </div>
          )}
        </div>

        {/* Milestone list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {form.milestones.map((ms, i) => (
            <div key={i} style={{ background: "#1a1d26", border: "1px solid #2a3050", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontFamily: "monospace", color: "#00d4aa",
                }}>
                  {i + 1}
                </span>
                <input
                  className="input"
                  placeholder="Milestone description"
                  value={ms.description}
                  onChange={(e) => updateMilestone(i, "description", e.target.value)}
                  style={{ flex: 2 }}
                />
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={ms.amount}
                    onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                    style={{ paddingRight: 54 }}
                  />
                  <span style={{
                    position: "absolute", right: 10, top: "50%",
                    transform: "translateY(-50%)", fontSize: "0.72rem", color: "#2775CA",
                    pointerEvents: "none",
                  }}>
                    USDC
                  </span>
                </div>
                {form.milestones.length > 1 && (
                  <button
                    onClick={() => removeMilestone(i)}
                    style={{ background: "none", border: "none", color: "#4a5068", cursor: "pointer" }}
                  >
                    x
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <hr className="divider" />

        {/* Summary */}
        <div style={{ background: "#1a1d26", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          {[
            { label: "Total to freelancer", value: total.toFixed(2) + " USDC" },
            { label: "Platform fee (1%)",   value: fee.toFixed(2)   + " USDC" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem" }}>
              <span style={{ color: "#7a8099" }}>{label}</span>
              <span style={{ fontFamily: "monospace" }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #2a3050", paddingTop: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>You deposit</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.1rem", color: "#00d4aa" }}>
              {deposit.toFixed(2)} USDC
            </span>
          </div>
        </div>

        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          Approve USDC from wallet to confirm the job transaction.
        </div>

        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: 14 }}
          onClick={handleSubmit}
          disabled={loading || deposit === 0}
        >
          {loading
            ? <><span className="spinner" /> Processing...</>
            : "Deposit " + deposit.toFixed(2) + " USDC & Post Job"
          }
        </button>
      </div>
    </div>
  );
}
