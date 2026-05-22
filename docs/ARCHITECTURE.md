# FreelanceArc — Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Arc Testnet                                 │
│                    Chain ID: 5042002 | USDC gas                      │
│                                                                       │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐    │
│  │    FreelanceEscrow.sol   │    │    InvoiceRegistry.sol        │    │
│  │                          │    │                               │    │
│  │  createJob()             │    │  createInvoice()              │    │
│  │  acceptJob()             │    │  getClientInvoices()          │    │
│  │  submitDeliverable()     │    │  markPaid()                   │    │
│  │  approveDeliverable()    │    │                               │    │
│  │  raiseDispute()          │    │  INV-1001, INV-1002...        │    │
│  │  releaseMilestone()      │    └──────────────────────────────┘    │
│  │  claimAfterTimeout()     │                                         │
│  │                          │    USDC: 0x360000...0000               │
│  └─────────────────────────┘    (native gas + ERC-20, 6 decimals)   │
└─────────────────────────────────────────────────────────────────────┘
           ▲  events (sub-second finality)          ▲ reads
           │                                         │
┌──────────┴──────────────────────┐    ┌────────────┴──────────────┐
│         Backend (Express)        │    │      Frontend (React)      │
│                                  │    │                            │
│  Event Listener (ethers.js WS)  │    │  useWallet()               │
│  ├── JobCreated → DB + Invoice   │    │  useEscrow()               │
│  ├── JobAccepted → DB            │    │                            │
│  ├── Completed → mark paid       │    │  Pages:                    │
│  └── Disputed → alert            │    │  ├── Landing               │
│                                  │    │  ├── Dashboard             │
│  REST API:                       │    │  ├── CreateJob             │
│  ├── GET /api/invoices           │    │  ├── JobDetail             │
│  ├── POST /api/invoices          │    │  └── Invoices              │
│  ├── GET /api/jobs               │    │                            │
│  └── PATCH /api/jobs/:id         │    │  MetaMask → Arc Testnet    │
│                                  │    │  ethers.js v6              │
│  PDF Generator (pdfkit)         │    └────────────────────────────┘
│  MongoDB (Mongoose)              │
└──────────────────────────────────┘
```

## Complete Job Lifecycle

```
State Machine:

  OPEN ──────────────────────────── CANCELLED
   │  (client cancels, full refund)
   │
   │ freelancer.acceptJob()
   ▼
  ACTIVE ─────────────────────────── (milestone releases anytime)
   │
   │ freelancer.submitDeliverable(ipfsHash)
   ▼
  SUBMITTED
   │
   ├── client.approveDeliverable() ──► COMPLETED (funds released)
   │
   ├── client.raiseDispute() ─────── DISPUTED ─► admin.resolveDispute()
   │                                                │
   │                                                └── winner gets funds
   │
   └── no action for 7 days:
       freelancer.claimAfterTimeout() ─► COMPLETED
```

## USDC Flow

```
Client Wallet
    │
    │  approve(escrow, totalAmount + fee)
    │  createJob() ──► USDC locked in FreelanceEscrow
    │
    ├── On approveDeliverable():
    │     1% fee ──────────────────────────────► feeRecipient
    │     99% USDC ───────────────────────────► Freelancer Wallet
    │                   (~1 second on Arc)
    │
    └── On dispute:
          admin decides split or full to winner
```

## Invoice Auto-Generation

```
1. Client calls createJob() on-chain
2. JobCreated event emitted on Arc (~1 second)
3. Backend eventListener catches it:
   - Creates Invoice record in MongoDB (INV-XXXX)
   - Generates PDF with job details
4. Frontend can query /api/invoices?address=0x...
5. When job completes → invoice marked paid
```

## Gas on Arc

```
┌─────────────────────────────────────────────────────┐
│ Arc uses USDC as the native gas token                │
│                                                       │
│ • No ETH needed — ever                               │
│ • Predictable fees (stable, no ETH price exposure)   │
│ • Gas unit = USDC (18 decimals for native gas)       │
│ • ERC-20 interface uses 6 decimals                   │
│ • Sub-second deterministic finality                  │
└─────────────────────────────────────────────────────┘
```
