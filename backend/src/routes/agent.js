import express from "express";
import { ethers } from "ethers";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

const router = express.Router();

const ESCROW_ABI = [
  "function getTotalJobs() view returns (uint256)",
  "function getJob(uint256 jobId) view returns (tuple(uint256 id, address client, address freelancer, uint256 totalAmount, uint256 platformFee, string title, string descriptionHash, uint8 status, uint256 createdAt, uint256 disputedAt, uint256 clientSplitPercent, bool freelancerAgreedToSplit, tuple(string description, uint256 amount, uint8 status, string deliverableHash, uint256 submittedAt)[] milestones))",
  "function acceptJob(uint256 jobId)",
  "function submitMilestone(uint256 jobId, uint256 milestoneIndex, string deliverableHash)",
];

const AGENT_SKILLS = {
  writing:       ["writing", "write", "copywriting", "copy", "content creation", "blog post", "article", "blog"],
  research:      ["research", "summary", "report", "analysis", "summarize", "summarise"],
  codeReview:    ["code review", "review code", "bug", "debugging", "audit code"],
  branding:      ["logo", "brand", "naming", "brand name", "slogan", "tagline"],
  smartContract: ["smart contract", "audit", "solidity", "security audit", "contract audit"],
  seo:           ["seo", "proofreading", "editing", "proofread", "edit"],
};

function canHandle(title, description) {
  const text = (title + " " + (description || "")).toLowerCase();
  for (const [skill, keywords] of Object.entries(AGENT_SKILLS)) {
    if (keywords.some((kw) => text.includes(kw))) return skill;
  }
  return null;
}

function getCapabilitiesList() {
  return Object.values(AGENT_SKILLS).flat();
}

async function callClaude(systemPrompt, userPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude error: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function doWork(skill, jobTitle, milestoneDescription, jobDescription) {
  const systemPrompts = {
    writing:       "You are a professional content writer and copywriter. Write engaging, clear and well-structured content.",
    research:      "You are a professional researcher and analyst. Provide thorough, accurate and well-organized research.",
    codeReview:    "You are a senior software engineer specializing in code review. Identify bugs, improvements and best practices.",
    branding:      "You are a professional brand strategist and creative director. Create compelling brand identities.",
    smartContract: "You are a smart contract security expert. Audit contracts thoroughly and identify vulnerabilities.",
    seo:           "You are an SEO expert and professional editor. Optimize content and fix all errors.",
  };

  const systemPrompt = systemPrompts[skill] ||
    "You are a professional freelancer AI agent. You deliver high quality work exactly as requested.";

  return callClaude(
    systemPrompt,
    `JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription || "No description provided"}
MILESTONE TO COMPLETE: ${milestoneDescription}

Complete this milestone with professional quality work. Be thorough and detailed. Your full response is the deliverable.`
  );
}

async function signAndSendTransaction(contractAddress, functionName, args, log) {
  const apiKey       = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletId     = process.env.CIRCLE_AGENT_WALLET_ID;

  if (!apiKey || !entitySecret || !walletId) {
    throw new Error("Circle credentials not configured");
  }

  const sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  let abiFunctionSignature;
  let abiParameters;

  if (functionName === "acceptJob") {
    abiFunctionSignature = "acceptJob(uint256)";
    abiParameters        = [Number(args[0]).toString()];
  } else if (functionName === "submitMilestone") {
    abiFunctionSignature = "submitMilestone(uint256,uint256,string)";
    abiParameters        = [
      Number(args[0]).toString(),
      Number(args[1]).toString(),
      args[2],
    ];
  } else {
    throw new Error("Unknown function: " + functionName);
  }

  log(`Calling ${abiFunctionSignature} — params: ${JSON.stringify(abiParameters)}`);

  const txResponse = await sdk.createTransaction({
    idempotencyKey:      crypto.randomUUID(),
    walletId,
    contractAddress,
    abiFunctionSignature,
    abiParameters,
    fee: {
      type:   "level",
      config: { feeLevel: "MEDIUM" },
    },
  });

  if (!txResponse.data?.id) {
    const errMsg = txResponse.message || txResponse.code || JSON.stringify(txResponse);
    throw new Error("Transaction creation failed: " + errMsg);
  }

  const txId = txResponse.data.id;
  log(`Transaction ID: ${txId} — polling for confirmation...`);

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusRes = await sdk.getTransaction({ id: txId });
    const tx        = statusRes.data?.transaction;
    const state     = tx?.state;
    const txHash    = tx?.txHash;

    log(`State: ${state}`);

    if (state === "CONFIRMED" || state === "COMPLETE") {
      log(`Confirmed! Hash: ${txHash}`);
      return txHash || txId;
    }
    if (state === "FAILED" || state === "CANCELLED") {
      const reason = tx?.errorReason || tx?.errorCode || "unknown";
      throw new Error(`Transaction ${state}: ${reason}`);
    }
  }

  throw new Error("Transaction timed out after 90 seconds");
}

// GET /api/agent/info
router.get("/info", async (req, res) => {
  try {
    const agentAddress = process.env.AI_AGENT_ADDRESS;
    if (!agentAddress) {
      return res.json({ address: null, balance: "0", capabilities: getCapabilitiesList() });
    }
    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const balance  = await provider.getBalance(agentAddress);
    res.json({
      address:      agentAddress,
      balance:      ethers.formatUnits(balance, 18),
      capabilities: getCapabilitiesList(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/jobs
router.get("/jobs", async (req, res) => {
  try {
    const escrowAddr   = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
    const agentAddress = process.env.AI_AGENT_ADDRESS;
    if (!escrowAddr) throw new Error("VITE_ESCROW_CONTRACT_ADDRESS not set");

    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const escrow   = new ethers.Contract(escrowAddr, ESCROW_ABI, provider);
    const total    = await escrow.getTotalJobs();
    const totalNum = Number(total);

    const matchingJobs = [];
    for (let i = totalNum; i >= 1; i--) {
      try {
        const job = await escrow.getJob(BigInt(i));
        if (Number(job.status) !== 0) continue;
        if (agentAddress && job.client.toLowerCase() === agentAddress.toLowerCase()) continue;

        let jobDescription = "";
        try {
          const meta = JSON.parse(job.descriptionHash);
          jobDescription = meta.description || "";
        } catch {}

        const skill = canHandle(job.title, jobDescription);
        if (!skill) continue;

        matchingJobs.push({
          jobId:       i,
          title:       job.title,
          description: jobDescription,
          amount:      ethers.formatUnits(job.totalAmount, 6) + " USDC",
          milestones:  job.milestones.length,
          skill,
        });
      } catch {}
    }

    res.json({ jobs: matchingJobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/run
router.post("/run", async (req, res) => {
  const logs = [];
  const log  = (msg) => { logs.push(msg); console.log("AGENT:", msg); };

  try {
    const { jobId: selectedJobId } = req.body;
    const escrowAddr   = process.env.VITE_ESCROW_CONTRACT_ADDRESS;
    const agentAddress = process.env.AI_AGENT_ADDRESS;

    if (!escrowAddr)   throw new Error("VITE_ESCROW_CONTRACT_ADDRESS not set");
    if (!agentAddress) throw new Error("AI_AGENT_ADDRESS not set");

    const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
    const escrow   = new ethers.Contract(escrowAddr, ESCROW_ABI, provider);

    log(`Agent address: ${agentAddress}`);

    const balance = await provider.getBalance(agentAddress);
    log(`Agent balance: ${ethers.formatUnits(balance, 18)} USDC`);

    if (balance === 0n) {
      return res.json({
        success: false,
        message: "Agent wallet has no USDC. Fund it at faucet.circle.com — Address: " + agentAddress,
        logs,
      });
    }

    const total    = await escrow.getTotalJobs();
    const totalNum = Number(total);
    log(`Total jobs on chain: ${totalNum}`);

    let targetJob   = null;
    let targetSkill = null;
    let targetId    = null;

    if (selectedJobId) {
      log(`Loading selected job #${selectedJobId}...`);
      const job = await escrow.getJob(BigInt(selectedJobId));

      if (Number(job.status) !== 0) {
        return res.json({ success: false, message: `Job #${selectedJobId} is not open.`, logs });
      }
      if (job.client.toLowerCase() === agentAddress.toLowerCase()) {
        return res.json({ success: false, message: "Agent cannot work on its own job.", logs });
      }

      let jobDescription = "";
      try {
        const meta = JSON.parse(job.descriptionHash);
        jobDescription = meta.description || "";
      } catch {}

      const skill = canHandle(job.title, jobDescription);
      if (!skill) {
        return res.json({
          success: false,
          message: `Job #${selectedJobId} is not in the agent skill set. Try a job with keywords like writing, research, code review, brand, audit, seo.`,
          logs,
        });
      }

      targetJob   = job;
      targetSkill = skill;
      targetId    = selectedJobId;
      log(`Job #${targetId} "${job.title}" — skill: ${skill}`);

    } else {
      for (let i = totalNum; i >= 1; i--) {
        try {
          const job = await escrow.getJob(BigInt(i));
          if (Number(job.status) !== 0) continue;
          if (job.client.toLowerCase() === agentAddress.toLowerCase()) continue;

          let jobDescription = "";
          try {
            const meta = JSON.parse(job.descriptionHash);
            jobDescription = meta.description || "";
          } catch {}

          const skill = canHandle(job.title, jobDescription);
          if (!skill) { log(`Job #${i} "${job.title}" — not in skill set`); continue; }

          log(`Job #${i} "${job.title}" — matches skill: ${skill}`);
          targetJob   = job;
          targetSkill = skill;
          targetId    = i;
          break;
        } catch (e) {
          log(`Error reading job #${i}: ${e.message}`);
        }
      }

      if (!targetJob) {
        return res.json({
          success: true,
          message: "No suitable open jobs found. Post a job with keywords like: writing, blog, research, code review, brand, audit, seo.",
          logs,
          results: [],
        });
      }
    }

    log(`Selected Job #${targetId}: "${targetJob.title}" (skill: ${targetSkill})`);

    // Accept job
    log(`Accepting job #${targetId}...`);
    const acceptTx = await signAndSendTransaction(
      escrowAddr,
      "acceptJob",
      [targetId],
      log
    );
    log(`Job #${targetId} accepted! Tx: ${acceptTx}`);

    // Work through milestones
    const milestoneResults = [];

    for (let m = 0; m < targetJob.milestones.length; m++) {
      const milestone = targetJob.milestones[m];
      log(`Working on milestone ${m + 1}/${targetJob.milestones.length}: "${milestone.description}"...`);

      let jobDescription = "";
      try {
        const meta = JSON.parse(targetJob.descriptionHash);
        jobDescription = meta.description || "";
      } catch {}

      const work = await doWork(targetSkill, targetJob.title, milestone.description, jobDescription);
      log(`Milestone ${m + 1} done — ${work.length} characters`);

      const deliverableRef = `AI-AGENT | ${targetSkill.toUpperCase()} | Job #${targetId} MS${m + 1} | ${work.slice(0, 80)}...`;

      const submitTx = await signAndSendTransaction(
        escrowAddr,
        "submitMilestone",
        [targetId, m, deliverableRef],
        log
      );
      log(`Milestone ${m + 1} submitted! Tx: ${submitTx}`);

      milestoneResults.push({
        milestone:   milestone.description,
        work,
        deliverable: deliverableRef,
        tx:          submitTx,
      });
    }

    const result = {
      jobId:      targetId,
      title:      targetJob.title,
      skill:      targetSkill,
      amount:     ethers.formatUnits(targetJob.totalAmount, 6) + " USDC",
      milestones: milestoneResults,
      acceptTx,
    };

    log(`All milestones submitted for Job #${targetId}`);

    res.json({
      success: true,
      message: `Agent completed job #${targetId}: "${targetJob.title}"`,
      logs,
      results: [result],
    });

  } catch (err) {
    console.error("Agent run error:", err.message);
    res.status(500).json({ success: false, error: err.message, logs });
  }
});

export default router;
