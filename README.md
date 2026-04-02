# AgentVault ⚡
**The Clearing House for AI Agents on Solana**

> *The market is building Venmo for agents. AgentVault builds their DTCC.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF)](https://solana.com)
[![Colosseum Frontier](https://img.shields.io/badge/Hackathon-Colosseum%20Frontier%202026-blue)](https://colosseum.com/frontier)

## The Problem

Every agent framework solves payments: *"How do I take $0.001 from an agent for an API call?"*

**Nobody solves settlement:** *"What happens when a deal is $10,000 and involves 4 irreversible steps?"*


Payment ≠ Settlement. Stripe ≠ DTCC. Venmo ≠ Clearing House.

## What is AgentVault?

**Agent Settlement Protocol (ASP)** — the first on-chain clearing house for AI agents:

- **Atomic multi-step execution** — all steps succeed or everything rolls back
- **Trust-weighted economics** — on-chain reputation directly determines fees and credit
- **PolicyController** — algorithmic risk engine, no human-in-the-loop
- **Deferred Settlement** — VISA-style credit for high-frequency agents

## Architecture


## Trust-Weighted Economics

| Trust Score | Fee | Collateral | Credit Limit |
|---|---|---|---|
| 0–20 (new) | 0.75% | 150% | $0 |
| 21–50 (verified) | 0.50% | 100% | $100 |
| 51–80 (trusted) | 0.35% | 50% | $1,000 |
| 81–100 (institutional) | 0.15% | 0% | $50,000 |

## Tech Stack

| Component | Technology |
|---|---|
| Smart contracts | Rust + Anchor |
| Payment | Solana Actions (Blinks) |
| NFT liquidity | Tensor |
| DeFi | Raydium, Meteora |
| Oracle | Pyth Network |
| Tx cost | ~$0.00025 |

## Competitive Position

| Project | Payment | Multi-step Settlement | Trust → Economics |
|---|---|---|---|
| x402 (Coinbase) | ✅ | ❌ | ❌ |
| ERC-8183 (Virtuals) | ✅ | ⚠️ single job | ❌ |
| **AgentVault ASP** | ✅ | ✅ **atomic** | ✅ **PolicyController** |

## Getting Started

```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol.git
cd agent-settlement-protocol
anchor build
anchor test
```

## Hackathon

[Colosseum Frontier](https://colosseum.com/frontier) — April 6 – May 11, 2026 | Prize pool: $2.5M

**Author:** Piter [@FirstNFT](https://twitter.com/FirstNFT) — Kyiv, Ukraine

---
*Trust → Economic Enforcement → Guaranteed Execution → Credit Flywheel*
