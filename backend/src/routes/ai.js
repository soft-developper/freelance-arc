import express from "express";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const router = express.Router();

async function callClaude(messages, stream = false) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream,
      messages,
    }),
  });
  return response;
}

// POST /api/ai/generate-job
router.post("/generate-job", async (req, res) => {
  try {
    const { roughIdea } = req.body;
    if (!roughIdea) return res.status(400).json({ error: "roughIdea required" });

    const response = await callClaude([
      {
        role: "user",
        content: `You are a professional freelance job posting assistant.

A client has this rough idea for a job:
"${roughIdea}"

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
- Total USDC should be reasonable for the work described
- Milestones should be logical phases of the project
- Return only valid JSON, no explanation, no markdown`,
      },
    ]);

    const data  = await response.json();
    const text  = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/dispute-verdict
router.post("/dispute-verdict", async (req, res) => {
  try {
    const { job, messages } = req.body;

    const milestonesText = job.milestones
      .map((ms, i) => `Milestone ${i + 1}: ${ms.description} — ${ms.amount} USDC — Status: ${["Pending","Submitted","Approved"][Number(ms.status)] || "Unknown"}`)
      .join("\n");

    const chatText = messages
      .map((m) => `${m.isClient ? "Client" : "Freelancer"}: ${m.message}`)
      .join("\n");

    const response = await callClaude([
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

    const data  = await response.json();
    const text  = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/split-milestones
router.post("/split-milestones", async (req, res) => {
  try {
    const { title, description, totalBudget } = req.body;

    const response = await callClaude([
      {
        role: "user",
        content: `You are a freelance project consultant.

Job title: ${title}
Description: ${description}
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

    const data  = await response.json();
    const text  = data.content[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
