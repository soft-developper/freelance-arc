export async function generateJobDescription(roughIdea, onChunk) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      messages: [
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
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("AI agent failed. Check your API key.");
  }

  let fullText = "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            fullText += parsed.delta.text;
            onChunk(fullText);
          }
        } catch {}
      }
    }
  }

  return fullText;
}

export async function generateDisputeVerdict(job, messages) {
  const milestonesText = job.milestones
    .map((ms, i) => `Milestone ${i + 1}: ${ms.description} — ${ms.amount} USDC — Status: ${["Pending","Submitted","Approved"][Number(ms.status)] || "Unknown"}`)
    .join("\n");

  const chatText = messages
    .map((m) => `${m.isClient ? "Client" : "Freelancer"}: ${m.message}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a neutral AI arbitrator for a freelance dispute.

JOB TITLE: ${job.title}

MILESTONES:
${milestonesText}

DISPUTE CHAT:
${chatText || "No messages yet."}

DELIVERABLE SUBMITTED: ${job.milestones.find(ms => ms.deliverableHash)?.deliverableHash || "None provided"}

Based on all the evidence above, provide a fair verdict in this EXACT JSON format and nothing else:
{
  "summary": "2-3 sentence neutral summary of what happened",
  "verdict": "one of: pay_freelancer | refund_client | split",
  "splitPercent": 70,
  "reasoning": "2-3 sentence explanation of why this is fair",
  "recommendation": "one short sentence telling the admin what to do"
}

Rules:
- splitPercent is how much the FREELANCER should receive (0-100)
- If verdict is pay_freelancer, set splitPercent to 100
- If verdict is refund_client, set splitPercent to 0
- Be fair and neutral
- Return only valid JSON`,
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function generateMilestoneSplit(title, description, totalBudget) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
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
      ],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
