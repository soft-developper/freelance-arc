import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = "FreelanceOnChain <onboarding@resend.dev>";
const APP    = "FreelanceOnChain";

// Helper — only sends if contact is email type
export function extractEmail(descriptionHash) {
  try {
    const meta = JSON.parse(descriptionHash);
    if (meta.contactType === "email" && meta.contact?.includes("@")) {
      return meta.contact.trim();
    }
    return null;
  } catch {
    return null;
  }
}

// ── EMAIL TEMPLATES ───────────────────────────────────────────────

export async function sendJobAcceptedEmail({ to, jobId, jobTitle, freelancerAddress }) {
  if (!to) return;
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject: `Your job "${jobTitle}" has been accepted`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f1a2e;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#0ea5e9;margin-bottom:8px;">Job Accepted 🤝</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">A freelancer has accepted your job and is ready to start work.</p>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid rgba(14,165,233,0.2);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Job</div>
            <div style="font-weight:600;font-size:16px;">${jobTitle}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Job #${jobId}</div>
          </div>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid rgba(14,165,233,0.2);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Freelancer</div>
            <div style="font-family:monospace;font-size:13px;color:#0ea5e9;">${freelancerAddress}</div>
          </div>

          <a href="https://www.freelanceonchain.xyz/job/${jobId}"
             style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            View Job
          </a>

          <p style="margin-top:24px;font-size:12px;color:#475569;">
            You will receive updates as milestones are submitted for review.
          </p>
        </div>
      `,
    });
    console.log(`📧  Email sent — job accepted #${jobId} → ${to}`);
  } catch (err) {
    console.warn(`⚠️  Email failed (job accepted #${jobId}):`, err.message);
  }
}

export async function sendMilestoneSubmittedEmail({ to, jobId, jobTitle, milestoneIndex, milestoneDesc }) {
  if (!to) return;
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject: `Milestone submitted for "${jobTitle}" — please review`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f1a2e;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#0ea5e9;margin-bottom:8px;">Milestone Submitted 📦</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">Your freelancer has submitted a milestone and is waiting for your approval.</p>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid rgba(14,165,233,0.2);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Job</div>
            <div style="font-weight:600;font-size:16px;">${jobTitle}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Job #${jobId}</div>
          </div>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid rgba(168,85,247,0.3);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Milestone ${milestoneIndex + 1}</div>
            <div style="font-weight:600;">${milestoneDesc || "Milestone " + (milestoneIndex + 1)}</div>
          </div>

          <a href="https://www.freelanceonchain.xyz/job/${jobId}"
             style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            Review Milestone
          </a>

          <p style="margin-top:24px;font-size:12px;color:#475569;">
            Review the deliverable and approve or request a revision from the job page.
          </p>
        </div>
      `,
    });
    console.log(`📧  Email sent — milestone submitted #${jobId}[${milestoneIndex}] → ${to}`);
  } catch (err) {
    console.warn(`⚠️  Email failed (milestone submitted #${jobId}):`, err.message);
  }
}

export async function sendMilestoneApprovedEmail({ to, jobId, jobTitle, milestoneIndex, milestoneDesc, amount }) {
  if (!to) return;
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject: `Payment released for "${jobTitle}" — milestone approved`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f1a2e;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#10b981;margin-bottom:8px;">Milestone Approved ✅</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">The client has approved your milestone and USDC has been released to your wallet.</p>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid rgba(14,165,233,0.2);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Job</div>
            <div style="font-weight:600;font-size:16px;">${jobTitle}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Job #${jobId}</div>
          </div>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid rgba(16,185,129,0.3);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Milestone ${milestoneIndex + 1}</div>
            <div style="font-weight:600;">${milestoneDesc || "Milestone " + (milestoneIndex + 1)}</div>
          </div>

          <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Amount Released</div>
            <div style="font-size:28px;font-weight:700;font-family:monospace;color:#10b981;">${amount} USDC</div>
          </div>

          <a href="https://www.freelanceonchain.xyz/job/${jobId}"
             style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            View Job
          </a>

          <p style="margin-top:24px;font-size:12px;color:#475569;">
            The USDC has been sent directly to your connected wallet.
          </p>
        </div>
      `,
    });
    console.log(`📧  Email sent — milestone approved #${jobId}[${milestoneIndex}] → ${to}`);
  } catch (err) {
    console.warn(`⚠️  Email failed (milestone approved #${jobId}):`, err.message);
  }
}

export async function sendDisputeRaisedEmail({ to, jobId, jobTitle, raisedBy }) {
  if (!to) return;
  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject: `Dispute raised on "${jobTitle}"`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#0f1a2e;color:#e2e8f0;border-radius:12px;">
          <h2 style="color:#ef4444;margin-bottom:8px;">Dispute Raised ⚖️</h2>
          <p style="color:#94a3b8;margin-bottom:24px;">A dispute has been raised on this job. Both parties can discuss and resolve through the dispute chat.</p>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:20px;border:1px solid rgba(239,68,68,0.3);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Job</div>
            <div style="font-weight:600;font-size:16px;">${jobTitle}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Job #${jobId}</div>
          </div>

          <div style="background:#162034;border-radius:8px;padding:16px;margin-bottom:24px;border:1px solid rgba(239,68,68,0.2);">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Raised By</div>
            <div style="font-family:monospace;font-size:13px;color:#ef4444;">${raisedBy}</div>
          </div>

          <a href="https://www.freelanceonchain.xyz/job/${jobId}"
             style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            View Dispute
          </a>

          <p style="margin-top:24px;font-size:12px;color:#475569;">
            If the dispute is not resolved within 7 days, an admin will step in to resolve it.
          </p>
        </div>
      `,
    });
    console.log(`📧  Email sent — dispute raised #${jobId} → ${to}`);
  } catch (err) {
    console.warn(`⚠️  Email failed (dispute raised #${jobId}):`, err.message);
  }
}
