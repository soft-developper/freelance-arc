export default function Agent() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "60vh", textAlign: "center",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%", marginBottom: 24,
        background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))",
        border: "2px solid rgba(168,85,247,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "2rem",
      }}>
        🤖
      </div>
      <h1 style={{ fontSize: "2rem", marginBottom: 12 }}>AI Agent</h1>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 16px", borderRadius: 100, marginBottom: 20,
        background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
        fontSize: "0.82rem", color: "#a855f7",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7", animation: "pulse 2s infinite" }} />
        Coming Soon
      </div>
      <p style={{ color: "#7a8099", fontSize: "1rem", maxWidth: 480, lineHeight: 1.7, marginBottom: 32 }}>
        We are building an autonomous AI agent that browses open jobs, does the work using Claude AI, and submits deliverables on-chain to earn USDC — all without human intervention.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 480, width: "100%" }}>
        {[
          { icon: "🔍", label: "Scans open jobs" },
          { icon: "🧠", label: "Does the work with AI" },
          { icon: "💸", label: "Earns USDC on-chain" },
        ].map((f) => (
          <div key={f.label} style={{
            padding: 16, borderRadius: 10, textAlign: "center",
            background: "#12141a", border: "1px solid #1f2330",
          }}>
            <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontSize: "0.75rem", color: "#7a8099" }}>{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
