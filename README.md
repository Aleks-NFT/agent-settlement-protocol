# Agent Settlement Protocol (ASP)

**The Clearing House for AI Agents on Solana**

> *The market is building Venmo for agents. AgentVault builds their DTCC.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF)](https://solana.com)
[![Colosseum Frontier](https://img.shields.io/badge/Hackathon-Colosseum%20Frontier%202026-blue)](https://colosseum.com/frontier)
[![Tests](https://img.shields.io/badge/Tests-19%2F19%20passing-brightgreen)](https://github.com/Aleks-NFT/agent-settlement-protocol)
[![Devnet](https://img.shields.io/badge/Devnet-live-9945FF)](https://explorer.solana.com/address/24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ?cluster=devnet)

---

## The Problem

The market is solving Oracle Problem: who decides what happened.
Nobody is solving Settlement Problem: what happens AFTER the oracle decides, for AI agents running complex multi-step strategies.

### Two Real Failures That Prove This

**UMA Governance Attack — $7M stolen (March 2025)**
A single whale with 25% of UMA voting tokens forced a false resolution on Polymarket.
$7M went to the manipulator irreversibly. Polymarket response: "no refunds, not a market failure."
Root cause: settlement was final with no post-condition verification layer.

**Settlement Divergence — $57M volume (February 2026)**
Same Super Bowl event. Same moment. Two different outcomes:
- Kalshi settled YES at $0.26
- Polymarket settled YES at $1.00

An agent arbitraging both platforms lost on both sides simultaneously.
No rollback. No protection. CFTC complaint filed.

**Drift Hack — $285M stolen (April 2026)**
The largest DeFi hack of 2026. Drift suspended all deposits and withdrawals mid-session.
Agents running active strategies had zero recourse — no atomic revert, no protection layer, no refund.
Root cause: no settlement envelope around agent positions.

---

## What ASP Builds

Agent Settlement Protocol (ASP) — the first on-chain clearing house for AI agents on Solana.

**Without AgentVault:**
Agent -> Buy YES $5K -> Swap USDC to SOL -> Reinvest
OK FAIL (slippage)
Agent stuck with unwanted asset. No revert. Funds frozen.

**With AgentVault ASP:**
Agent -> LOCK -> PRE-CHECK -> EXECUTE -> SETTLE
on any failure:
REVERT -> full refund

---

## First Use Case: Prediction Markets

Prediction markets do $2B+ per week. 14 of 20 top traders are bots.
These bots have no clearing house. AgentVault is building it.

ASP wraps every agent strategy in a settlement envelope:
- **Multi-step atomic execution** — buy, claim, reinvest as one atomic transaction
- **Cross-venue protection** — Kalshi divergence triggers atomic revert
- **Trust-weighted economics** — on-chain reputation sets fee and collateral

---

## Settlement NFT — Key Innovation

Every position becomes a transferable Settlement NFT with embedded settlement logic.

Settlement NFT = position + settlement conditions + trust metadata

The agent can sell the NFT without closing the position.
The buyer inherits the position AND all settlement guarantees.
PolicyController recalculates fee and collateral based on the new owner trust score.

No protocol has ever embedded settlement logic inside the position token itself.
Not CTF (Gnosis), not Augur, not Azuro.

---

## Architecture

### Settlement Lifecycle

LOCKED --> PRE_CHECKED --> EXECUTED --> SETTLED
| | |
+--------------+--------------+--> REVERTED

| Instruction | What Happens |
|---|---|
| `lock` | Mint Settlement NFT, escrow USDC + collateral in Vault PDA |
| `pre_check` | Verify Pyth price within tolerance, check liquidity |
| `execute_trade` | Record fill price, release collateral to agent, trust +1 |
| `settle` | Pyth confirms settle price, fee to feeCollector, trust +2 |
| `revert` | Full USDC refund, vault closes, trust -1 |

---

## Trust-Weighted Economics (PolicyController)

Fully algorithmic. No credit committee. No human in the loop.

| Trust Score | Status | Fee | Collateral |
|---|---|---|---|
| 0-20 | New | 0.75% | 150% |
| 21-50 | Verified | 0.50% | 100% |
| 51-80 | Trusted | 0.35% | 50% |
| 81-100 | Institutional | 0.15% | 0% |

**Trust Flywheel:**
More settlements -> Higher trust -> Lower fee + Less collateral -> More settlements

---

## Competitive Position

| Protocol | Oracle | Multi-step Atomic | Trust Economics | Agent Native | Chain |
|---|:---:|:---:|:---:|:---:|---|
| UMA | YES | NO | NO | NO | Ethereum |
| Gnosis CTF | YES | NO | NO | NO | Ethereum |
| Augur v2 | YES | NO | NO | NO | Dead |
| Azuro | YES | NO | NO | partial | Polygon |
| Polymarket | YES | NO | NO | CLOB only | Polygon |
| Drift | YES | NO | NO | partial | HACKED |
| **AgentVault ASP** | **YES** | **YES atomic N-step** | **YES** | **YES MCP+A2A** | **Solana** |

---

## Program

| | |
|---|---|
| **Program ID** | `24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ` |
| **Network** | Solana Devnet |
| **Framework** | Anchor 0.31 |
| **Tests** | 19/19 passing |
| **Explorer** | https://explorer.solana.com/address/24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ?cluster=devnet |

---

## Quickstart

### Prerequisites

```bash
node >= 20
anchor >= 0.31
solana-cli >= 1.18
```

### Setup

```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol.git
cd agent-settlement-protocol
yarn install
```

### Run Tests (19/19)

```bash
anchor test
```

### Run Live Demo on Devnet

```bash
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

npx ts-node --esm demo/full-lifecycle.ts
```

Expected output:
1 Setup: USDC mint + token accounts
USDC Mint: ...
Minted USDC: 10,000 USDC -> agent

2 Init Reputation
Trust Score: 50/100

3 Lock - escrow 1,000 USDC
Status: locked

4 Pyth Mock Feed
Price: $1.000000

5 PreCheck - validate price on-chain
Status: preChecked

6 Execute - fill at $1.05
Trust Score: 51/100 (+1)

7 Settle - fee deducted
Status: settled
Fee paid: 5 USDC
Trust Score: 53/100 (+2)

LIFECYCLE COMPLETE

---

## Security

- **PDA authority** — vault USDC can only be moved by vault PDA signer seeds
- **Revival attack protection** — `vault.is_closed = true` prevents double-spend
- **Timeout enforcement** — `timeout_slot` checked on every instruction
- **Arithmetic safety** — all math via `checked_*` ops, zero unchecked overflow
- **Pyth validation** — magic bytes `0xa1b2c3e4`, staleness <=1h, confidence <=2%

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust + Anchor 0.31 |
| Oracle | Pyth Network (raw binary feed parser) |
| Testing | LiteSVM (19/19 tests) |
| Agent interface | MCP Tools + Solana Actions (Blinks) |
| Transaction cost | $0.00025 |

---

## Roadmap

| Milestone | Status |
|---|---|
| Core state machine (lock / revert / preCheck / execute / settle) | Done |
| Pyth price feed integration | Done |
| Reputation + PolicyController | Done |
| 19/19 LiteSVM tests | Done |
| Devnet deploy | Done |
| Live demo script | Done |
| Post-check instruction | Next |
| Multi-agent batch settlement | Next |
| Mainnet deploy | Post-hackathon |

---

## Hackathon

**Colosseum Frontier** — April 6 to May 11, 2026 — Prize pool $2.5M
**Superteam Ukraine Track** — 10K USDG

Author: Piter @FirstNFT — Kyiv, Ukraine

> *"Trust -> Economic Enforcement -> Guaranteed Execution -> Credit Flywheel"*

---

## License

MIT 2026 AgentVault
