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
        Completed,
        Disputed,
        Cancelled
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Approved,
        Disputed
    }

    struct Milestone {
        string description;
        uint256 amount;
        MilestoneStatus status;
        string deliverableHash;
        uint256 submittedAt;
    }

    struct Job {
        uint256 id;
        address client;
        address freelancer;
        uint256 totalAmount;
        uint256 platformFee;
        string title;
        string descriptionHash;
        JobStatus status;
        uint256 createdAt;
        uint256 disputedAt;
        uint256 deadlineDuration;  // in seconds, 0 = no deadline
        uint256 acceptedAt;        // when freelancer accepted
        uint256 clientSplitPercent;
        bool freelancerAgreedToSplit;
        Milestone[] milestones;
    }

    uint256 private _nextJobId = 1;
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public freelancerJobs;

    event JobCreated(uint256 indexed jobId, address indexed client, uint256 totalAmount, string title);
    event JobAccepted(uint256 indexed jobId, address indexed freelancer);
    event JobExpired(uint256 indexed jobId, address indexed expiredFreelancer);
    event MilestoneSubmitted(uint256 indexed jobId, uint256 indexed milestoneIndex, string deliverableHash);
    event MilestoneApproved(uint256 indexed jobId, uint256 indexed milestoneIndex, uint256 amount);
    event AllMilestonesApproved(uint256 indexed jobId, address indexed freelancer, uint256 totalReleased);
    event JobCompleted(uint256 indexed jobId, address indexed freelancer, uint256 totalReleased);
    event JobDisputed(uint256 indexed jobId, address indexed raisedBy, string reason);
    event DisputeMessage(uint256 indexed jobId, address indexed sender, string message, uint256 timestamp);
    event MilestoneRevisionRequested(uint256 indexed jobId, uint256 indexed milestoneIndex, string feedback);
    event SplitProposed(uint256 indexed jobId, address indexed client, uint256 clientPercent, uint256 freelancerPercent);
    event SplitAccepted(uint256 indexed jobId, uint256 clientAmount, uint256 freelancerAmount);
    event DisputeResolved(uint256 indexed jobId, address indexed winner, uint256 amount);
    event JobCancelled(uint256 indexed jobId);

    error JobNotFound();
    error NotClient();
    error NotFreelancer();
    error InvalidStatus();
    error ZeroAmount();
    error InvalidFee();
    error InvalidMilestone();
    error DisputeTimeoutNotReached();
    error InvalidSplitPercent();

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    // ── CLIENT ACTIONS ─────────────────────────────────────────────

    function createJob(
        string calldata title,
        string calldata descHash,
        string[] calldata milestoneDescs,
        uint256[] calldata milestoneAmounts,
        uint256 deadlineDays  // 0 = no deadline
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
        job.deadlineDuration = deadlineDays * 1 days;

        for (uint256 i = 0; i < milestoneDescs.length; i++) {
            job.milestones.push(Milestone({
                description:     milestoneDescs[i],
                amount:          milestoneAmounts[i],
                status:          MilestoneStatus.Pending,
                deliverableHash: "",
                submittedAt:     0
            }));
        }

        clientJobs[msg.sender].push(jobId);
        usdc.safeTransferFrom(msg.sender, address(this), deposit);
        emit JobCreated(jobId, msg.sender, total, title);
    }

    // Client approves a specific milestone and releases its payment
    function approveMilestone(uint256 jobId, uint256 milestoneIndex) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Active, "Job not active");
        require(milestoneIndex < job.milestones.length, "Invalid milestone");

        Milestone storage ms = job.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.Submitted, "Milestone not submitted");

        ms.status = MilestoneStatus.Approved;

        uint256 milestoneFee     = (ms.amount * platformFeeBps) / 10_000;
        uint256 freelancerAmount = ms.amount - milestoneFee;

        usdc.safeTransfer(feeRecipient, milestoneFee);
        usdc.safeTransfer(job.freelancer, freelancerAmount);

        emit MilestoneApproved(jobId, milestoneIndex, freelancerAmount);

        bool allDone = true;
        for (uint256 i = 0; i < job.milestones.length; i++) {
            if (job.milestones[i].status != MilestoneStatus.Approved) {
                allDone = false;
                break;
            }
        }
        if (allDone) {
            job.status = JobStatus.Completed;
            emit JobCompleted(jobId, job.freelancer, job.totalAmount);
        }
    }

    // Client approves ALL remaining milestones at once and releases full payment
    function approveAllMilestones(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Active, "Job not active");

        uint256 totalFreelancer = 0;
        uint256 totalFee        = 0;

        for (uint256 i = 0; i < job.milestones.length; i++) {
            Milestone storage ms = job.milestones[i];
            if (ms.status != MilestoneStatus.Approved) {
                ms.status = MilestoneStatus.Approved;
                uint256 milestoneFee     = (ms.amount * platformFeeBps) / 10_000;
                uint256 freelancerAmount = ms.amount - milestoneFee;
                totalFreelancer += freelancerAmount;
                totalFee        += milestoneFee;
                emit MilestoneApproved(jobId, i, freelancerAmount);
            }
        }

        if (totalFee > 0)        usdc.safeTransfer(feeRecipient, totalFee);
        if (totalFreelancer > 0) usdc.safeTransfer(job.freelancer, totalFreelancer);

        job.status = JobStatus.Completed;
        emit JobCompleted(jobId, job.freelancer, totalFreelancer);
    }

    // Client requests revision on a specific milestone
    function requestMilestoneRevision(uint256 jobId, uint256 milestoneIndex, string calldata feedback) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Active, "Job not active");
        require(milestoneIndex < job.milestones.length, "Invalid milestone");

        Milestone storage ms = job.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.Submitted, "Milestone not submitted");

        ms.status = MilestoneStatus.Pending;
        emit MilestoneRevisionRequested(jobId, milestoneIndex, feedback);
        emit DisputeMessage(jobId, msg.sender, feedback, block.timestamp);
    }

    // Client raises a dispute on the whole job
    function raiseDispute(uint256 jobId, string calldata reason) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Active, "Job not active");
        job.status     = JobStatus.Disputed;
        job.disputedAt = block.timestamp;
        emit JobDisputed(jobId, msg.sender, reason);
        emit DisputeMessage(jobId, msg.sender, reason, block.timestamp);
    }

    // Client proposes a split
    function proposeSplit(uint256 jobId, uint256 freelancerPercent) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Disputed, "Not disputed");
        if (freelancerPercent == 0 || freelancerPercent > 100) revert InvalidSplitPercent();
        job.clientSplitPercent      = 100 - freelancerPercent;
        job.freelancerAgreedToSplit = false;
        emit SplitProposed(jobId, msg.sender, 100 - freelancerPercent, freelancerPercent);
    }

    function cancelJob(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.client) revert NotClient();
        require(job.status == JobStatus.Open, "Job not open");
        job.status = JobStatus.Cancelled;

        uint256 refund = 0;
        for (uint256 i = 0; i < job.milestones.length; i++) {
            if (job.milestones[i].status != MilestoneStatus.Approved) {
                refund += job.milestones[i].amount;
            }
        }
        refund += job.platformFee;
        usdc.safeTransfer(job.client, refund);
        emit JobCancelled(jobId);
    }

    // ── FREELANCER ACTIONS ─────────────────────────────────────────

    function acceptJob(uint256 jobId) external {
        Job storage job = _requireJob(jobId);
        require(job.status == JobStatus.Open, "Job not open");
        require(msg.sender != job.client, "Client cannot be freelancer");
        job.freelancer = msg.sender;
        job.status     = JobStatus.Active;
        job.acceptedAt = block.timestamp;
        freelancerJobs[msg.sender].push(jobId);
        emit JobAccepted(jobId, msg.sender);
    }

    // Anyone can call this to expire a job where freelancer missed deadline
    function expireJob(uint256 jobId) external {
        Job storage job = _requireJob(jobId);
        require(job.status == JobStatus.Active, "Job not active");
        require(job.deadlineDuration > 0, "No deadline set");
        require(block.timestamp > job.acceptedAt + job.deadlineDuration, "Deadline not passed");

        bool anySubmitted = false;
        for (uint256 i = 0; i < job.milestones.length; i++) {
            if (job.milestones[i].status != MilestoneStatus.Pending) {
                anySubmitted = true;
                break;
            }
        }
        require(!anySubmitted, "Freelancer has submitted work");

        address oldFreelancer = job.freelancer;
        job.freelancer = address(0);
        job.status     = JobStatus.Open;
        job.acceptedAt = 0;

        emit JobExpired(jobId, oldFreelancer);
    }

    // Freelancer submits work for a specific milestone
    function submitMilestone(uint256 jobId, uint256 milestoneIndex, string calldata deliverableHash) external {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(job.status == JobStatus.Active, "Job not active");
        require(milestoneIndex < job.milestones.length, "Invalid milestone");

        Milestone storage ms = job.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.Pending, "Milestone already submitted or approved");

        ms.deliverableHash = deliverableHash;
        ms.submittedAt     = block.timestamp;
        ms.status          = MilestoneStatus.Submitted;

        emit MilestoneSubmitted(jobId, milestoneIndex, deliverableHash);
    }

    // Freelancer adds dispute message
    function addDisputeMessage(uint256 jobId, string calldata message) external {
        Job storage job = _requireJob(jobId);
        require(
            msg.sender == job.client || msg.sender == job.freelancer,
            "Not a party"
        );
        require(job.status == JobStatus.Disputed, "Not disputed");
        emit DisputeMessage(jobId, msg.sender, message, block.timestamp);
    }

    // Freelancer accepts split
    function acceptSplit(uint256 jobId) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(job.clientSplitPercent > 0, "No split proposed");

        job.status = JobStatus.Completed;

        uint256 remaining = 0;
        for (uint256 i = 0; i < job.milestones.length; i++) {
            if (job.milestones[i].status != MilestoneStatus.Approved) {
                remaining += job.milestones[i].amount;
            }
        }

        uint256 freelancerPercent = 100 - job.clientSplitPercent;
        uint256 freelancerAmount  = (remaining * freelancerPercent) / 100;
        uint256 clientAmount      = remaining - freelancerAmount;

        usdc.safeTransfer(feeRecipient, job.platformFee);
        usdc.safeTransfer(job.freelancer, freelancerAmount);
        usdc.safeTransfer(job.client, clientAmount);

        emit SplitAccepted(jobId, clientAmount, freelancerAmount);
    }

    // Freelancer claims after timeout on a submitted milestone
    function claimMilestoneAfterTimeout(uint256 jobId, uint256 milestoneIndex) external nonReentrant {
        Job storage job = _requireJob(jobId);
        if (msg.sender != job.freelancer) revert NotFreelancer();
        require(job.status == JobStatus.Active, "Job not active");
        require(milestoneIndex < job.milestones.length, "Invalid milestone");

        Milestone storage ms = job.milestones[milestoneIndex];
        require(ms.status == MilestoneStatus.Submitted, "Milestone not submitted");
        require(block.timestamp >= ms.submittedAt + DISPUTE_TIMEOUT, "Timeout not reached");

        ms.status = MilestoneStatus.Approved;

        uint256 milestoneFee     = (ms.amount * platformFeeBps) / 10_000;
        uint256 freelancerAmount = ms.amount - milestoneFee;

        usdc.safeTransfer(feeRecipient, milestoneFee);
        usdc.safeTransfer(job.freelancer, freelancerAmount);

        emit MilestoneApproved(jobId, milestoneIndex, freelancerAmount);
    }

    // ── ADMIN ──────────────────────────────────────────────────────

    function resolveDispute(uint256 jobId, address winner, bool split) external onlyOwner nonReentrant {
        Job storage job = _requireJob(jobId);
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(block.timestamp >= job.disputedAt + ADMIN_ESCALATION_TIMEOUT, "Wait for escalation timeout");

        job.status = JobStatus.Completed;

        uint256 remaining = 0;
        for (uint256 i = 0; i < job.milestones.length; i++) {
            if (job.milestones[i].status != MilestoneStatus.Approved) {
                remaining += job.milestones[i].amount;
            }
        }

        if (split) {
            uint256 half = remaining / 2;
            usdc.safeTransfer(job.client, half);
            usdc.safeTransfer(job.freelancer, remaining - half);
            usdc.safeTransfer(feeRecipient, job.platformFee);
        } else {
            if (winner == job.freelancer) {
                usdc.safeTransfer(feeRecipient, job.platformFee);
                usdc.safeTransfer(winner, remaining);
            } else {
                usdc.safeTransfer(winner, remaining + job.platformFee);
            }
        }
        emit DisputeResolved(jobId, winner, remaining);
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

    function _requireJob(uint256 jobId) internal view returns (Job storage) {
        if (jobId == 0 || jobId >= _nextJobId) revert JobNotFound();
        return jobs[jobId];
    }
}
