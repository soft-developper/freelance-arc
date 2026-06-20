import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function shortAddr(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function JobChat({ jobId, wallet, job }) {
  const [messages, setMessages]       = useState([]);
  const [text, setText]               = useState("");
  const [file, setFile]               = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState(null);
  const fileInputRef                  = useRef(null);
  const pollRef                       = useRef(null);
  const chatBoxRef                    = useRef(null);

  const myAddress    = wallet.address?.toLowerCase();
  const isClient     = job?.client?.toLowerCase()     === myAddress;
  const isFreelancer = job?.freelancer?.toLowerCase() === myAddress;
  const canChat      = isClient || isFreelancer;

  async function fetchMessages() {
    if (!myAddress || !jobId) return;
    try {
      const res = await fetch(`${API}/api/chat/${jobId}?address=${myAddress}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }

  useEffect(() => {
    if (!canChat) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [jobId, myAddress, canChat]);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith("image/")) {
      setFilePreview({ type: "image", url: URL.createObjectURL(f), name: f.name });
    } else {
      setFilePreview({ type: "audio", name: f.name });
    }
  }

  function clearFile() {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendMessage() {
    if (!text.trim() && !file) return;
    if (!myAddress) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("sender", myAddress);
      if (text.trim()) formData.append("message", text.trim());
      if (file) formData.append("file", file);

      const res = await fetch(`${API}/api/chat/${jobId}`, {
        method: "POST",
        body:   formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      setText("");
      clearFile();
      await fetchMessages();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function groupByDate(msgs) {
    const groups = [];
    let lastDate = null;
    for (const msg of msgs) {
      const date = formatDate(msg.created_at);
      if (date !== lastDate) {
        groups.push({ type: "date", label: date });
        lastDate = date;
      }
      groups.push({ type: "message", data: msg });
    }
    return groups;
  }

  if (!canChat) return null;

  const grouped        = groupByDate(messages);
  const clientAddr     = job?.client?.toLowerCase();
  const freelancerAddr = job?.freelancer?.toLowerCase();

  return (
    <div className="card" style={{ border: "1px solid rgba(14,165,233,0.2)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem",
        }}>
          💬
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Job Chat</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Private between client and freelancer
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Live</span>
        </div>
      </div>

      {/* Participants */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Client",     addr: clientAddr,     color: "var(--usdc)"    },
          { label: "Freelancer", addr: freelancerAddr, color: "var(--primary)" },
        ].map(({ label, addr, color }) => (
          <div key={label} style={{
            flex: 1, padding: "6px 10px", borderRadius: 6,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            fontSize: "0.72rem",
          }}>
            <span style={{ color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label} </span>
            <span style={{ fontFamily: "monospace", color }}>{shortAddr(addr)}</span>
            {addr === myAddress && <span style={{ color: "var(--text-dim)", marginLeft: 4 }}>(you)</span>}
          </div>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={chatBoxRef}
        style={{
          background: "var(--bg)", borderRadius: 10, padding: 14,
          minHeight: 220, maxHeight: 420, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 4,
          marginBottom: 14, border: "1px solid var(--border)",
        }}
      >
        {grouped.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-dim)", padding: 32 }}>
            <span style={{ fontSize: "2rem" }}>👋</span>
            <p style={{ fontSize: "0.82rem", textAlign: "center" }}>
              No messages yet. Start the conversation about your job agreement.
            </p>
          </div>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === "date") return (
              <div key={idx} style={{ textAlign: "center", margin: "10px 0 4px" }}>
                <span style={{ fontSize: "0.68rem", color: "var(--text-dim)", background: "var(--bg-elevated)", padding: "2px 10px", borderRadius: 10 }}>
                  {item.label}
                </span>
              </div>
            );

            const msg         = item.data;
            const isMe        = msg.sender === myAddress;
            const isClientMsg = msg.sender === clientAddr;

            return (
              <div key={msg.id} style={{
                display: "flex", flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: 6,
              }}>
                <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginBottom: 3, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                  {isMe ? "You" : (isClientMsg ? "Client" : "Freelancer")} · {formatTime(msg.created_at)}
                </div>
                <div style={{
                  maxWidth: "75%",
                  background: isMe ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (isMe ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.08)"),
                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  padding: "8px 12px",
                  wordBreak: "break-word",
                }}>
                  {msg.file_type === "image" && msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.file_url}
                        alt="attachment"
                        style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", marginBottom: msg.message ? 8 : 0 }}
                      />
                    </a>
                  )}
                  {msg.file_type === "audio" && msg.file_url && (
                    <audio controls style={{ width: "100%", marginBottom: msg.message ? 8 : 0, accentColor: "var(--primary)" }}>
                      <source src={msg.file_url} />
                      Your browser does not support audio.
                    </audio>
                  )}
                  {msg.message && (
                    <span style={{ fontSize: "0.875rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.message}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* File preview */}
      {filePreview && (
        <div style={{
          marginBottom: 10, padding: "8px 12px",
          background: "var(--bg-elevated)", border: "1px solid rgba(14,165,233,0.2)",
          borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
        }}>
          {filePreview.type === "image" ? (
            <img src={filePreview.url} alt="preview" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
          ) : (
            <span style={{ fontSize: "1.4rem" }}>🎵</span>
          )}
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filePreview.name}
          </span>
          <button onClick={clearFile} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>
            ✕
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 10, fontSize: "0.8rem" }}>{error}</div>
      )}

      {/* Input area */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach image or audio"
            style={{
              width: 40, height: 40, borderRadius: 8, flexShrink: 0,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", color: "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            📎
          </button>
        </div>

        <textarea
          className="textarea"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: "vertical", padding: "9px 12px", fontSize: "0.875rem" }}
        />

        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={sending || (!text.trim() && !file)}
          style={{ height: 40, padding: "0 16px", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {sending ? <span className="spinner" /> : "Send"}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: "0.68rem", color: "var(--text-dim)", textAlign: "center" }}>
        Messages are private and will be deleted when the job is completed or cancelled.
      </div>
    </div>
  );
}
