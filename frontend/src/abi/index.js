export const ESCROW_ABI = [
  // Write
  "function createJob(string title, string descriptionHash, string[] milestoneDescs, uint256[] milestoneAmounts) returns (uint256)",
  "function acceptJob(uint256 jobId)",
  "function submitMilestone(uint256 jobId, uint256 milestoneIndex, string deliverableHash)",
  "function approveMilestone(uint256 jobId, uint256 milestoneIndex)",
  "function approveAllMilestones(uint256 jobId)",
  "function requestMilestoneRevision(uint256 jobId, uint256 milestoneIndex, string feedback)",
  "function raiseDispute(uint256 jobId, string reason)",
  "function proposeSplit(uint256 jobId, uint256 freelancerPercent)",
  "function acceptSplit(uint256 jobId)",
  "function addDisputeMessage(uint256 jobId, string message)",
  "function cancelJob(uint256 jobId)",
  "function claimMilestoneAfterTimeout(uint256 jobId, uint256 milestoneIndex)",

  // Read
  "function getJob(uint256 jobId) view returns (tuple(uint256 id, address client, address freelancer, uint256 totalAmount, uint256 platformFee, string title, string descriptionHash, uint8 status, uint256 createdAt, uint256 disputedAt, uint256 clientSplitPercent, bool freelancerAgreedToSplit, tuple(string description, uint256 amount, uint8 status, string deliverableHash, uint256 submittedAt)[] milestones))",
  "function getMilestones(uint256 jobId) view returns (tuple(string description, uint256 amount, uint8 status, string deliverableHash, uint256 submittedAt)[])",
  "function getClientJobs(address client) view returns (uint256[])",
  "function getFreelancerJobs(address freelancer) view returns (uint256[])",
  "function getTotalJobs() view returns (uint256)",

  // Events
  "event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title)",
  "event JobAccepted(uint256 indexed jobId, address indexed freelancer)",
  "event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneIndex, string deliverableHash)",
  "event MilestoneApproved(uint256 indexed jobId, uint256 indexed milestoneIndex, uint256 amount)",
  "event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 totalReleased)",
  "event JobDisputed(uint256 indexed jobId, address indexed raisedBy, string reason)",
  "event DisputeMessage(uint256 indexed jobId, address indexed sender, string message, uint256 timestamp)",
  "event MilestoneRevisionRequested(uint256 indexed jobId, uint256 indexed milestoneIndex, string feedback)",
  "event SplitProposed(uint256 indexed jobId, address indexed client, uint256 clientPercent, uint256 freelancerPercent)",
  "event SplitAccepted(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount)",
];

export const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];
