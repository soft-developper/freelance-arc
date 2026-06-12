import express from "express";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const router = express.Router();

async function callClaude(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error("Unexpected response from Claude: " + JSON.stringify(data));
  }

  const text  = data.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error("Claude returned invalid JSON: " + clean);
  }
}

// POST /api/ai/generate-job
router.post("/generate-job", async (req, res) => {
  try {
    const { roughIdea, category, subcategory, skills } = req.body;
    if (!roughIdea) return res.status(400).json({ error: "roughIdea required" });

    const categoryContext = category
      ? `The job is in the category: ${category}${subcategory ? ` — specifically: ${subcategory}` : ""}.`
      : "";

    const skillsContext = skills && skills.length > 0
      ? `The client has indicated these required skills: ${skills.join(", ")}.`
      : "";

    const result = await callClaude([
      {
        role: "user",
        content: `You are a professional freelance job posting assistant.

A client has this rough idea for a job:
"${roughIdea}"

${categoryContext}
${skillsContext}

Generate a professional job post in this EXACT JSON format and nothing else:
{
  "title": "clear job title under 10 words",
  "description": "2-3 sentence professional description of what needs to be done",
  "milestones": [
    { "description": "milestone name", "amount": "number in USDC" },
    { "description": "milestone name", "amount": "number in USDC" }
  ]
}

Rules:
- 2 to 4 milestones maximum
- Total USDC should be reasonable for the work described and the category
- Milestones should be logical phases of the project
- If skills are provided, reference them in the description
- Return only valid JSON, no explanation, no markdown`,
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("generate-job error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/dispute-verdict
router.post("/dispute-verdict", async (req, res) => {
  try {
    const { job, messages } = req.body;
    if (!job) return res.status(400).json({ error: "job required" });

    const milestonesText = job.milestones
      .map((ms, i) => `Milestone ${i + 1}: ${ms.description} — ${ms.amount} USDC — Status: ${["Pending","Submitted","Approved"][Number(ms.status)] || "Unknown"}`)
      .join("\n");

    const chatText = (messages || [])
      .map((m) => `${m.isClient ? "Client" : "Freelancer"}: ${m.message}`)
      .join("\n");

    const result = await callClaude([
      {
        role: "user",
        content: `You are a neutral AI arbitrator for a freelance dispute.

JOB TITLE: ${job.title}

MILESTONES:
${milestonesText}

DISPUTE CHAT:
${chatText || "No messages yet."}

DELIVERABLE SUBMITTED: ${job.milestones.find(ms => ms.deliverableHash)?.deliverableHash || "None provided"}

Provide a fair verdict in this EXACT JSON format and nothing else:
{
  "summary": "2-3 sentence neutral summary of what happened",
  "verdict": "one of: pay_freelancer | refund_client | split",
  "splitPercent": 70,
  "reasoning": "2-3 sentence explanation of why this is fair",
  "recommendation": "one short sentence telling the admin what to do"
}

Rules:
- splitPercent is how much the FREELANCER should receive (0-100)
- If verdict is pay_freelancer set splitPercent to 100
- If verdict is refund_client set splitPercent to 0
- Be fair and neutral
- Return only valid JSON`,
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("dispute-verdict error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/split-milestones
router.post("/split-milestones", async (req, res) => {
  try {
    const { title, description, totalBudget } = req.body;
    if (!title || !totalBudget) return res.status(400).json({ error: "title and totalBudget required" });

    const result = await callClaude([
      {
        role: "user",
        content: `You are a freelance project consultant.

Job title: ${title}
Description: ${description || ""}
Total budget: ${totalBudget} USDC

Split this budget into 2-4 fair milestones in this EXACT JSON format and nothing else:
{
  "milestones": [
    { "description": "milestone name", "amount": "number" },
    { "description": "milestone name", "amount": "number" }
  ]
}

Rules:
- Amounts must add up to exactly ${totalBudget}
- Milestones should be logical phases
- First milestone is usually the smallest (20-30%)
- Return only valid JSON`,
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("split-milestones error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
