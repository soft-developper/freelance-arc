# FreelanceArc — USDC Freelancer Payment Platform on Arc

A full-stack freelancer payment platform built on [Arc](https://arc.io) — an EVM-compatible Layer-1 chain where USDC is the native gas token. Clients pay freelancers in USDC instantly via escrow smart contracts with auto-generated invoices.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Blockchain | Arc Testnet (Chain ID: 5042002) |
| Smart Contracts | Solidity 0.8.24 + Hardhat |
| Frontend | React + Vite + Ethers.js v6 |
| Backend | Node.js + Express + MongoDB |
| Stablecoin | USDC (ERC-20 on Arc) |

---

## Project Structure

```
freelance-arc/
├── contracts/              # Solidity smart contracts
│   ├── FreelanceEscrow.sol      # Core escrow contract
│   └── InvoiceRegistry.sol      # On-chain invoice registry
├── scripts/                # Hardhat deploy & interaction scripts
│   ├── deploy.js
│   └── interact.js
├── frontend/               # React app
│   └── src/
│       ├── abi/            # Contract ABIs
│       ├── components/     # Reusable UI components
│       ├── hooks/          # Custom React hooks (useEscrow, useWallet)
│       ├── pages/          # Dashboard, CreateJob, ManageJobs
│       └── utils/          # Arc chain config, USDC helpers
├── backend/                # Express REST API + DB
│   └── src/
│       ├── routes/         # /invoices, /jobs, /users
│       ├── services/       # Invoice PDF generation, email
│       └── models/         # Mongoose schemas
├── docs/                   # Architecture & flow diagrams
└── hardhat.config.js
```

---

## End-to-End Flow

```
Client                    Smart Contract              Freelancer
  │                            │                          │
  │── Create Job ─────────────>│                          │
  │   (deposit USDC escrow)    │                          │
  │                            │<── Accept Job ───────────│
  │                            │                          │
  │<── Invoice Auto-Generated ─┤                          │
  │                            │                          │
  │── Approve Deliverable ────>│                          │
  │                            │── Release USDC ─────────>│
  │                            │   (instant, ~1s)         │
  │                            │                          │
  │  [OR]                      │                          │
  │── Raise Dispute ──────────>│                          │
  │                            │── Arbitration ───────────│
```

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- MetaMask or Rabby browser wallet
- Arc Testnet USDC from [faucet.circle.com](https://faucet.circle.com)

### 2. Install

```bash
npm install          # root (Hardhat)
cd frontend && npm install
cd ../backend && npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Fill in: PRIVATE_KEY, MONGODB_URI, etc.
```

### 4. Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network arc-testnet
```

### 5. Run Frontend

```bash
cd frontend && npm run dev
```

### 6. Run Backend

```bash
cd backend && npm run dev
```

---

## Arc Network Details

| Parameter | Value |
|---|---|
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Gas Token | USDC (native) |
| USDC Address | `0x3600000000000000000000000000000000000000` |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |

---

## Key Features

- **Escrow on Arc** — USDC held in smart contract, released on milestone approval
- **Auto Invoices** — PDF invoices generated on job creation (on-chain + off-chain)
- **Instant Settlement** — Sub-second finality on Arc (~1 second)
- **Dispute Resolution** — Built-in arbitration with time-locked refund
- **Low Fees** — Predictable USDC gas fees (no ETH needed)
- **Multi-milestone** — Jobs split into phases, each with its own escrow

---

## Testnet Quickstart

1. Add Arc Testnet to MetaMask: RPC `https://rpc.testnet.arc.network`, Chain ID `5042002`
2. Get testnet USDC: [faucet.circle.com](https://faucet.circle.com)
3. Deploy contracts: `npx hardhat run scripts/deploy.js --network arc-testnet`
4. Open the frontend and create your first job!
