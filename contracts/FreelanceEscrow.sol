// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FreelanceEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public platformFeeBps = 100;
    address public feeRecipient;
    uint256 public constant DISPUTE_TIMEOUT = 7 days;
    uint256 public constant ADMIN_ESCALATION_TIMEOUT = 7 days;

    enum JobStatus {
        Open,
        Active,
        Submitted,
        Completed,
        Disputed,
        Refunded,
        Cancelled,
        Revision
    }

    struct Milestone {
        string description;
        uint256 amount;
        bool released;
    }

    struct Job {
        uint256 id;
        address client;
        address freelancer;
        uint256 totalAmount;
        uint256 platformFee;
        string title;
        string descriptionHash;
        string deliverableHash;
        JobStatus status;
        uint256 createdAt;
        uint256 submittedAt;
        uint256 disputedAt;
        uint256 invoiceId;
        Milestone[] milestones;
        // Split proposal
        uint256 clientSplitPercent;  // 0 means no proposal
        bool freelancerAgreedToSplit;
    }

    uint256 private _nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public freelancerJobs;

    // Events
    event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title);
    event JobAccepted(uint256 indexed jobId, address indexed freelancer);
    event DeliverableSubmitted(uint256 indexed jobId, string deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 amountReleased);
    event JobDisputed(uint256 indexed jobId, address indexed raisedBy, string reason);
    event DisputeMessage(uint256 indexed jobId, address indexed sender, string message, uint256 timestamp);
    event RevisionRequested(uint256 indexed jobId, address indexed client, string feedback);
    event SplitProposed(uint256 indexed jobId, address indexed client, uint256 clientPercent, uint256 freelancerPercent);
    event SplitAccepted(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
    event DisputeResolved(uint256 indexed jobId, address indexed winner, uint256 amount);
    event JobCancelled(uint256 indexed jobId);
    event MilestoneReleased(uint256 indexed jobId, uint256 milestoneIndex, uint256 amount);

    error JobNotFound();
    error NotClient();
    error NotFreelancer();
    error NotParty();
    error InvalidStatus();
    error ZeroAmount();
    error InvalidFee();
    error DisputeTimeoutNotReached();
    error InvalidSplitPercent();

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    // ── CLIENT ACTIONS ────────────────────────────────────────────

    function createJob(
        string calldata title,
        string calldata descHash,
        string[] calldata milestoneDescs,
        uint256[] calldata milestoneAmounts
    ) external nonReentrant returns (uint256 jobId) {
        require(milestoneDescs.length > 0, "Need at least 1 milestone");
        require(milestoneDescs.length == milestoneAmounts.length, "Milestones mismatch");

        uint256 total;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            if (milestoneAmounts[i] == 0) revert ZeroAmount();
            total += milestoneAmounts[i];
        }

        uint256 fee     = (total * platformFeeBps) / 10_000;
        uint256 deposit = total + fee;
        jobId           = _nextJobId++;

        Job storage job = jobs[jobId];
        job.id          = jobId;
        job.client      = msg.sender;
        job.totalAmount = total;
        job.platformFee = fee;
        job.title       = title;
        job.descriptionHash = descHash;
        job.status      = JobStatus.Open;
        job.createdAt   = block.timestamp;

        for (uint256 i = 0; i < milestoneDescs.length; i++) {
            job.milestones.push(Milestone({
                description: milestoneDescs[i],
                amount: milestoneAmounts[i],
                released: false
            }));
        }

        clientJobs[msg.sender].push(jobId);
        usdc.safeTransferFrom(msg.sender, address(this), deposit);
        emit JobCreated(jobId, msg.sender, total, title);
    }

    function approveDeliverable(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(
            job.status == JobStatus.Submitted || job.status == JobStatus.Disputed,
            "Invalid status"
        );
        job.status = JobStatus.Completed;
        _releaseFunds(job);
        emit JobCompleted(jobId, job.freelancer, job.totalAmount);
    }

    function releaseMilestone(uint256 jobId, uint256 milestoneIndex) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(milestoneIndex < job.milestones.length, "Invalid milestone");
        Milestone storage ms = job.milestones[milestoneIndex];
        require(!ms.released, "Already released");
        ms.released = true;
        usdc.safeTransfer(job.freelancer, ms.amount);
        emit MilestoneReleased(jobId, milestoneIndex, ms.amount);
    }

    function raiseDispute(uint256 jobId, string calldata reason) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Submitted, "Invalid status");
        job.status     = JobStatus.Disputed;
        job.disputedAt = block.timestamp;
        emit JobDisputed(jobId, msg.sender, reason);
        emit DisputeMessage(jobId, msg.sender, reason, block.timestamp);
    }

    // Client requests revision — job goes back to Active
    function requestRevision(uint256 jobId, string calldata feedback) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(
            job.status == JobStatus.Submitted || job.status == JobStatus.Disputed,
            "Invalid status"
        );
        job.status = JobStatus.Revision;
        emit RevisionRequested(jobId, msg.sender, feedback);
        emit DisputeMessage(jobId, msg.sender, feedback, block.timestamp);
    }

    // Client proposes a split e.g. 60% to freelancer, 40% back to client
    function proposeSplit(uint256 jobId, uint256 freelancerPercent) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Disputed, "Invalid status");
        if (freelancerPercent == 0 || freelancerPercent > 100) revert InvalidSplitPercent();
        job.clientSplitPercent      = 100 - freelancerPercent;
        job.freelancerAgreedToSplit = false;
        emit SplitProposed(jobId, msg.sender, 100 - freelancerPercent, freelancerPercent);
    }

    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Open, "Invalid status");
        job.status = JobStatus.Cancelled;
        usdc.safeTransfer(job.client, job.totalAmount + job.platformFee);
        emit JobCancelled(jobId);
    }

    // ── FREELANCER ACTIONS ────────────────────────────────────────

    function acceptJob(uint256 jobId) external {
        Job storage job = _requireJob(jobId);
        require(job.status == JobStatus.Open, "Invalid status");
        require(msg.sender != job.client, "Client cannot be freelancer");
        job.freelancer = msg.sender;
        job.status     = JobStatus.Active;
        freelancerJobs[msg.sender].push(jobId);
        emit JobAccepted(jobId, msg.sender);
    }

    function submitDeliverable(uint256 jobId, string calldata deliverableHash) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(
            job.status == JobStatus.Active || job.status == JobStatus.Revision,
            "Invalid status"
        );
        job.deliverableHash = deliverableHash;
        job.submittedAt     = block.timestamp;
        job.status          = JobStatus.Submitted;
        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    // Freelancer accepts the split proposed by client
    function acceptSplit(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(job.status == JobStatus.Disputed, "Invalid status");
        require(job.clientSplitPercent > 0, "No split proposed");

        job.status = JobStatus.Completed;

        uint256 freelancerPercent = 100 - job.clientSplitPercent;
        uint256 freelancerAmount  = (job.totalAmount * freelancerPercent) / 100;
        uint256 clientAmount      = job.totalAmount - freelancerAmount;

        usdc.safeTransfer(feeRecipient, job.platformFee);
        usdc.safeTransfer(job.freelancer, freelancerAmount);
        usdc.safeTransfer(job.client, clientAmount);

        emit SplitAccepted(jobId, clientAmount, freelancerAmount);
    }

    // Freelancer adds a message to the dispute chat
    function addDisputeMessage(uint256 jobId, string calldata message) external {
        Job storage job = _requireJob(jobId);
        require(
            msg.sender == job.client || msg.sender == job.freelancer,
            "Not a party"
        );
        require(job.status == JobStatus.Disputed, "Not in dispute");
        emit DisputeMessage(jobId, msg.sender, message, block.timestamp);
    }

    function claimAfterTimeout(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(job.status == JobStatus.Submitted, "Invalid status");
        require(block.timestamp >= job.submittedAt + DISPUTE_TIMEOUT, "Timeout not reached");
        job.status = JobStatus.Completed;
        _releaseFunds(job);
        emit JobCompleted(jobId, job.freelancer, job.totalAmount);
    }

    // ── ADMIN ACTIONS ─────────────────────────────────────────────

    // Admin can only step in after ADMIN_ESCALATION_TIMEOUT from dispute start
    function resolveDispute(uint256 jobId, address winner, bool split) external onlyOwner nonReentrant {
        Job storage job = _requireJob(jobId);
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(
            block.timestamp >= job.disputedAt + ADMIN_ESCALATION_TIMEOUT,
            "Wait for escalation timeout"
        );

        job.status = JobStatus.Completed;

        if (split) {
            uint256 half = job.totalAmount / 2;
            usdc.safeTransfer(job.client, half);
            usdc.safeTransfer(job.freelancer, job.totalAmount - half);
            usdc.safeTransfer(feeRecipient, job.platformFee);
        } else {
            if (winner == job.freelancer) {
                usdc.safeTransfer(feeRecipient, job.platformFee);
                usdc.safeTransfer(winner, job.totalAmount);
            } else {
                usdc.safeTransfer(winner, job.totalAmount + job.platformFee);
            }
        }
        emit DisputeResolved(jobId, winner, job.totalAmount);
    }

    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 500) revert InvalidFee();
        platformFeeBps = newFeeBps;
    }

    function updateFeeRecipient(address newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    // ── VIEWS ──────────────────────────────────────────────────────

    function getJob(uint256 jobId) external view returns (Job memory) { return jobs[jobId]; }
    function getMilestones(uint256 jobId) external view returns (Milestone[] memory) { return jobs[jobId].milestones; }
    function getClientJobs(address client) external view returns (uint256[] memory) { return clientJobs[client]; }
    function getFreelancerJobs(address freelancer) external view returns (uint256[] memory) { return freelancerJobs[freelancer]; }
    function getTotalJobs() external view returns (uint256) { return _nextJobId - 1; }

    // ── INTERNAL ───────────────────────────────────────────────────

    function _releaseFunds(Job storage job) internal {
        usdc.safeTransfer(feeRecipient, job.platformFee);
        usdc.safeTransfer(job.freelancer, job.totalAmount);
    }

    function _requireJob(uint256 jobId) internal view returns (Job storage) {
        if (jobId == 0 || jobId >= _nextJobId) revert JobNotFound();
        return jobs[jobId];
    }
}
