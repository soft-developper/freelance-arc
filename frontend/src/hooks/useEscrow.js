import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { ESCROW_ABI, USDC_ABI } from "../abi";
import { CONTRACTS } from "../utils/arc";

function toUSDC(amount) {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = frac.padEnd(6, "0").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded);
}

export function useEscrow(signer) {
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash]   = useState(null);
  const [error, setError]     = useState(null);

  const provider = signer?.provider || null;

  const exec = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const tx = await fn();
      setTxHash(tx.hash);
      const receipt = await tx.wait();
      return receipt;
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createJob = useCallback(async ({ title, descHash, milestones }) => {
    if (!signer) throw new Error("Wallet not connected");
    if (!CONTRACTS.ESCROW) throw new Error("Escrow contract address not set");

    const usdcContract   = new ethers.Contract(CONTRACTS.USDC,   USDC_ABI,   signer);
    const escrowContract = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer);

    const descs   = milestones.map((m) => m.description);
    const amounts = milestones.map((m) => toUSDC(m.amount));
    const total   = amounts.reduce((a, b) => a + b, 0n);
    const fee     = (total * 100n) / 10_000n;
    const deposit = total + fee;

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const address   = await signer.getAddress();
      const allowance = await usdcContract.allowance(address, CONTRACTS.ESCROW);
      if (allowance < deposit) {
        const approveTx = await usdcContract.approve(CONTRACTS.ESCROW, deposit);
        await approveTx.wait();
      }
      const tx = await escrowContract.createJob(title, descHash || "", descs, amounts);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (err) {
      const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [signer]);

  const acceptJob                  = useCallback((jobId) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).acceptJob(jobId)), [signer, exec]);
  const submitMilestone            = useCallback((jobId, i, hash) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).submitMilestone(jobId, i, hash)), [signer, exec]);
  const approveMilestone           = useCallback((jobId, i) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).approveMilestone(jobId, i)), [signer, exec]);
  const approveAllMilestones       = useCallback((jobId) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).approveAllMilestones(jobId)), [signer, exec]);
  const requestMilestoneRevision   = useCallback((jobId, i, feedback) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).requestMilestoneRevision(jobId, i, feedback)), [signer, exec]);
  const raiseDispute               = useCallback((jobId, reason) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).raiseDispute(jobId, reason)), [signer, exec]);
  const proposeSplit               = useCallback((jobId, percent) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).proposeSplit(jobId, percent)), [signer, exec]);
  const acceptSplit                = useCallback((jobId) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).acceptSplit(jobId)), [signer, exec]);
  const addDisputeMessage          = useCallback((jobId, msg) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).addDisputeMessage(jobId, msg)), [signer, exec]);
  const cancelJob                  = useCallback((jobId) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).cancelJob(jobId)), [signer, exec]);
  const claimMilestoneAfterTimeout = useCallback((jobId, i) => exec(() => new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, signer).claimMilestoneAfterTimeout(jobId, i)), [signer, exec]);

  const getJob = useCallback(async (jobId) => {
    if (!provider) return null;
    try {
      const c = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      return await c.getJob(jobId);
    } catch (e) {
      console.error("getJob error:", e.message);
      return null;
    }
  }, [provider]);

  const getClientJobs = useCallback(async (address) => {
    if (!provider) return [];
    try {
      const c = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      return await c.getClientJobs(address);
    } catch (e) {
      console.error("getClientJobs error:", e.message);
      return [];
    }
  }, [provider]);

  const getFreelancerJobs = useCallback(async (address) => {
    if (!provider) return [];
    try {
      const c = new ethers.Contract(CONTRACTS.ESCROW, ESCROW_ABI, provider);
      return await c.getFreelancerJobs(address);
    } catch (e) {
      console.error("getFreelancerJobs error:", e.message);
      return [];
    }
  }, [provider]);

  const getUSDCBalance = useCallback(async (address) => {
    if (!provider) return 0n;
    try {
      const bal = await provider.getBalance(address);
      return bal / 1_000_000_000_000n;
    } catch (e) {
      console.error("getUSDCBalance error:", e.message);
      return 0n;
    }
  }, [provider]);

  return {
    loading, txHash, error,
    createJob, acceptJob, submitMilestone, approveMilestone,
    approveAllMilestones, requestMilestoneRevision, raiseDispute,
    proposeSplit, acceptSplit, addDisputeMessage, cancelJob,
    claimMilestoneAfterTimeout, getJob, getClientJobs,
    getFreelancerJobs, getUSDCBalance,
  };
}
