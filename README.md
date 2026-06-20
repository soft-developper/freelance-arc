# FreelanceArc — USDC Freelancer Payment Platform on Arc

A full-stack freelancer payment platform built on [Arc](https://arc.io) 
An EVM-compatible Layer-1 chain where USDC is the native gas token
Clients pay freelancers in USDC instantly via escrow smart contracts with auto-generated invoices.



 Layer            Tech 

 Blockchain        Arc Testnet (Chain ID: 5042002) 

 Smart Contracts   Solidity 0.8.24 + Hardhat 

 Frontend          React + Vite + Ethers.js v6 

 Backend           Node.js + Express + Turso 

 Stablecoin        USDC (ERC-20 on Arc) 





 Parameter          Value

 Network            Arc Testnet 

 Chain ID           `5042002` 

 RPC                `https://rpc.testnet.arc.network` 

 Gas Token          USDC (native) 

 USDC Address       `0x3600000000000000000000000000000000000000` 

 Explorer           [testnet.arcscan.app](https://testnet.arcscan.app) 




Escrow on Arc        — USDC held in smart contract, released on milestone approval

Auto Invoices        — PDF invoices generated on job creation (on-chain + off-chain)

Instant Settlement   — Sub-second finality on Arc (~1 second)

Dispute Resolution   — Built-in arbitration with time-locked refund

Low Fees             — Predictable USDC gas fees (no ETH needed)

Multi-milestone      — Jobs split into phases, each with its own escrow




1. Add Arc Testnet to MetaMask: RPC `https://rpc.testnet.arc.network`, Chain ID `5042002`

2. Get testnet USDC: [faucet.circle.com](https://faucet.circle.com)

3. Deploy contracts: `npx hardhat run scripts/deploy.js --network arc-testnet`

4. Open the frontend and create your first job!
