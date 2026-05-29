const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function generateJobDescription(roughIdea, onChunk) {
  const response = await fetch(`${API}/api/ai/generate-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roughIdea }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "AI agent failed");
  }

  const data = await response.json();
  // Simulate streaming for UI effect
  onChunk(JSON.stringify(data));
  return JSON.stringify(data);
}

export async function generateDisputeVerdict(job, messages) {
  const response = await fetch(`${API}/api/ai/dispute-verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job, messages }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Verdict generation failed");
  }

  return response.json();
}

export async function generateMilestoneSplit(title, description, totalBudget) {
  const response = await fetch(`${API}/api/ai/split-milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, totalBudget }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Milestone split failed");
  }

  return response.json();
}
