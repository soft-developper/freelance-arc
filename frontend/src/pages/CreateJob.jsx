import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEscrow } from "../hooks/useEscrow";
import { generateJobDescription, generateMilestoneSplit } from "../hooks/useAgent";
import { JOB_CATEGORIES, getCategoryById } from "../utils/categories";

export default function CreateJob({ wallet }) {
  const navigate = useNavigate();
  const { createJob, loading, txHash, error } = useEscrow(wallet.signer);

  const [form, setForm] = useState({
    title:        "",
    description:  "",
    contact:      "",
    contactType:  "email",
    category:     "",
    subcategory:  "",
    skills:       [],
    deadlineDays: 0,
    milestones:   [{ description: "", amount: "" }],
  });

  const [roughIdea, setRoughIdea]       = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError]     = useState(null);
  const [agentText, setAgentText]       = useState("");
  const [splitLoading, setSplitLoading] = useState(false);
  const [totalBudget, setTotalBudget]   = useState("");
  const [showAgent, setShowAgent]       = useState(false);
  const [skillInput, setSkillInput]     = useState("");

  const selectedCategory = getCategoryById(form.category);

  const total   = form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const fee     = total * 0.01;
  const deposit = total + fee;

  const addMilestone    = () => setForm((f) => ({ ...f, milestones: [...f.milestones, { description: "", amount: "" }] }));
  const removeMilestone = (i) => setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }));
  const updateMilestone = (i, key, val) => setForm((f) => ({
    ...f, milestones: f.milestones.map((m, idx) => idx === i ? { ...m, [key]: val } : m),
  }));

  const toggleSkill = (skill) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }));
  };

  const addCustomSkill = () => {
    const s = skillInput.trim();
    if (!s || form.skills.includes(s)) return;
    setForm((f) => ({ ...f, skills: [...f.skills, s] }));
    setSkillInput("");
  };

  const handleGenerateJob = async () => {
    if (!roughIdea.trim()) return;
    setAgentLoading(true);
    setAgentError(null);
    setAgentText("");
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const response = await fetch(`${API}/api/ai/generate-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roughIdea,
          category:    form.category,
          subcategory: form.subcategory,
          skills:      form.skills,
        }),
      });

      if (!response.ok) throw new Error("AI agent failed");
      const parsed = await response.json();
      setAgentText(JSON.stringify(parsed));

      setForm((f) => ({
        ...f,
        title:       parsed.title || "",
        description: parsed.description || "",
        milestones:  parsed.milestones?.map((m) => ({
          description: m.description || "",
          amount:      String(parseFloat(m.amount) || ""),
        })) || [{ description: "", amount: "" }],
      }));
      setShowAgent(false);
      setAgentText("");
    } catch (e) {
      setAgentError("Agent failed: " + e.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const handleSplitMilestones = async () => {
    if (!form.title.trim() || !totalBudget) return;
    setSplitLoading(true);
    setAgentError(null);
    try {
      const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const response = await fetch(`${API}/api/ai/split-milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, totalBudget }),
      });
      const result = await response.json();
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
    if (!form.title.trim())    return alert("Enter a job title");
    if (!form.category)        return alert("Select a job category");
    if (!form.contact.trim())  return alert("Enter a contact so freelancers can reach you");
    if (form.milestones.some((m) => !m.description.trim() || !m.amount)) {
      return alert("Fill all milestone fields");
    }
    try {
      const descHash = JSON.stringify({
        description:  form.description,
        contact:      form.contact,
        contactType:  form.contactType,
        category:     form.category,
        subcategory:  form.subcategory,
        skills:       form.skills,
      });
      await createJob({ title: form.title, descHash, milestones: form.milestones, deadlineDays: form.deadlineDays });
      navigate("/dashboard");
    } catch {}
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 4 }}>Post a Job</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          USDC is held in escrow and released when you approve the work.
        </p>
      </div>

      {error      && <div className="alert alert-error">{error}</div>}
      {agentError && <div className="alert alert-error">{agentError}</div>}
      {txHash     && <div className="alert alert-success">Job created! Tx: <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{txHash}</span></div>}

      {/* AI Agent Box */}
      <div style={{ marginBottom: 24, padding: 20, background: "var(--arc-dim)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showAgent ? 14 : 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>
            AI
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>AI Job Assistant</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Describe your idea — AI writes the full job post with milestones
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAgent(!showAgent)}>
            {showAgent ? "Hide" : "Use AI"}
          </button>
        </div>

        {showAgent && (
          <div>
            <textarea
              className="textarea"
              placeholder='e.g. "I need someone to build a landing page for my SaaS. Budget around 150 USDC."'
              value={roughIdea}
              onChange={(e) => setRoughIdea(e.target.value)}
              style={{ minHeight: 80, marginBottom: 10 }}
            />
            {agentText && (
              <div style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: 8, marginBottom: 10, fontFamily: "monospace", fontSize: "0.72rem", color: "var(--primary)", maxHeight: 80, overflowY: "auto" }}>
                {agentText}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleGenerateJob}
              disabled={agentLoading || !roughIdea.trim()}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {agentLoading ? <><span className="spinner" /> AI is writing your job post...</> : "Generate Job Post with AI"}
            </button>
          </div>
        )}
      </div>

      <div className="card">

        {/* Title */}
        <div className="form-group">
          <label className="label">Job Title *</label>
          <input className="input" placeholder="e.g. Build a landing page for my SaaS" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>

        {/* Category */}
        <div className="form-group">
          <label className="label">Job Category *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
            {JOB_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => setForm((f) => ({ ...f, category: cat.id, subcategory: "", skills: [] }))}
                style={{
                  padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                  border: form.category === cat.id ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                  background: form.category === cat.id ? "var(--arc-dim)" : "var(--bg-elevated)",
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{cat.icon}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: form.category === cat.id ? 600 : 400, color: form.category === cat.id ? "var(--primary)" : "var(--text-muted)" }}>
                  {cat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Subcategory */}
        {selectedCategory && (
          <div className="form-group">
            <label className="label">Subcategory</label>
            <select
              className="input"
              value={form.subcategory}
              onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
            >
              <option value="">Select a subcategory</option>
              {selectedCategory.subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Skills */}
        {selectedCategory && (
          <div className="form-group">
            <label className="label">Required Skills</label>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
              Select skills freelancers need for this job.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {selectedCategory.skills.map((skill) => (
                <div
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  style={{
                    padding: "5px 12px", borderRadius: 100, cursor: "pointer", fontSize: "0.8rem", fontWeight: 500,
                    border: form.skills.includes(skill) ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                    background: form.skills.includes(skill) ? "var(--arc-dim)" : "var(--bg-elevated)",
                    color: form.skills.includes(skill) ? "var(--primary)" : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {form.skills.includes(skill) ? "✓ " : ""}{skill}
                </div>
              ))}
            </div>

            {/* Custom skill input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Add a custom skill..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
              />
              <button className="btn btn-secondary btn-sm" onClick={addCustomSkill} style={{ whiteSpace: "nowrap" }}>
                + Add
              </button>
            </div>

            {/* Custom skills added */}
            {form.skills.filter((s) => !selectedCategory.skills.includes(s)).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {form.skills.filter((s) => !selectedCategory.skills.includes(s)).map((skill) => (
                  <div key={skill} style={{
                    padding: "4px 10px", borderRadius: 100, fontSize: "0.78rem",
                    background: "var(--arc-dim)", border: "1.5px solid var(--primary)",
                    color: "var(--primary)", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {skill}
                    <span style={{ cursor: "pointer", opacity: 0.7 }} onClick={() => toggleSkill(skill)}>x</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected skills summary */}
            {form.skills.length > 0 && (
              <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {form.skills.length} skill{form.skills.length !== 1 ? "s" : ""} selected: {form.skills.join(", ")}
              </div>
            )}
          </div>
        )}

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
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>
            Freelancers will use this to reach you before accepting the job.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="input" style={{ width: 140, flexShrink: 0 }} value={form.contactType} onChange={(e) => setForm((f) => ({ ...f, contactType: e.target.value }))}>
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
                form.contactType === "email"    ? "you@example.com"     :
                form.contactType === "github"   ? "github.com/username" :
                form.contactType === "telegram" ? "@yourusername"       :
                form.contactType === "twitter"  ? "@yourusername"       :
                form.contactType === "discord"  ? "username#0000"       : "Your contact info"
              }
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
          </div>
        </div>

        {/* Deadline */}
        <div className="form-group">
          <label className="label">Job Deadline (optional)</label>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>
            If the freelancer hasn't submitted any work within this time, the job resets to Open and can be re-accepted. Set to 0 for no deadline.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              className="input"
              type="number"
              min="0"
              max="365"
              placeholder="0"
              value={form.deadlineDays}
              onChange={(e) => setForm((f) => ({ ...f, deadlineDays: Math.max(0, parseInt(e.target.value) || 0) }))}
              style={{ width: 100 }}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>days after freelancer accepts</span>
            {form.deadlineDays > 0 && (
              <span style={{ fontSize: "0.78rem", color: "var(--primary)", background: "var(--arc-dim)", padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(14,165,233,0.2)" }}>
                {form.deadlineDays} day{form.deadlineDays !== 1 ? "s" : ""} deadline
              </span>
            )}
          </div>
        </div>

        <hr className="divider" />

        {/* Milestones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Milestones</h3>
          <button className="btn btn-secondary btn-sm" onClick={addMilestone}>+ Add</button>
        </div>

        {/* AI Milestone Splitter */}
        <div style={{ marginBottom: 16, padding: 14, background: "var(--arc-dim)", border: "1px dashed rgba(14,165,233,0.3)", borderRadius: 8 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 8 }}>
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>AI Milestone Splitter</span>
            {" — "}Enter total budget and AI will split it into fair milestones.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input className="input" type="number" placeholder="Total budget e.g. 150" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} style={{ paddingRight: 54 }} />
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.72rem", color: "var(--usdc)", pointerEvents: "none" }}>USDC</span>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }} onClick={handleSplitMilestones} disabled={splitLoading || !totalBudget || !form.title.trim()}>
              {splitLoading ? <><span className="spinner" /> Splitting...</> : "AI Split"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {form.milestones.map((ms, i) => (
            <div key={i} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: "var(--arc-dim)", border: "1px solid rgba(14,165,233,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontFamily: "monospace", color: "var(--primary)" }}>
                  {i + 1}
                </span>
                <input className="input" placeholder="Milestone description" value={ms.description} onChange={(e) => updateMilestone(i, "description", e.target.value)} style={{ flex: 2 }} />
                <div style={{ position: "relative", flex: 1 }}>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={ms.amount} onChange={(e) => updateMilestone(i, "amount", e.target.value)} style={{ paddingRight: 54 }} />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.72rem", color: "var(--usdc)", pointerEvents: "none" }}>USDC</span>
                </div>
                {form.milestones.length > 1 && (
                  <button onClick={() => removeMilestone(i)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>x</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <hr className="divider" />

        {/* Summary */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          {[
            { label: "Total to freelancer", value: total.toFixed(2) + " USDC" },
            { label: "Platform fee (1%)",   value: fee.toFixed(2) + " USDC"   },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.875rem" }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <span style={{ fontFamily: "monospace" }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>You deposit</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1.1rem", color: "var(--primary)" }}>
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
          {loading ? <><span className="spinner" /> Processing...</> : "Deposit " + deposit.toFixed(2) + " USDC & Post Job"}
        </button>
      </div>
    </div>
  );
}
