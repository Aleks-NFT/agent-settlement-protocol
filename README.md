# AgentVault
**The Clearing House for AI Agents on Solana**

> *The market is building Venmo for agents. AgentVault builds their DTCC.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF)](https://solana.com)
[![Colosseum Frontier](https://img.shields.io/badge/Hackathon-Colosseum%20Frontier%202026-blue)](https://colosseum.com/frontier)

---

## The Problem

The market is solving Oracle Problem: who decides what happened.
Nobody is solving Settlement Problem: what happens AFTER the oracle decides, for AI agents running complex multi-step strategies.

### Two Real Failures That Prove This

**UMA Governance Attack - $7M stolen (March 2025)**
A single whale with 25% of UMA voting tokens forced a false resolution on Polymarket.
$7M went to the manipulator irreversibly. Polymarket response: "no refunds, not a market failure."
Root cause: settlement was final with no post-condition verification layer.

**Settlement Divergence - $57M volume (February 2026)**
Same Super Bowl event. Same moment. Two different outcomes:
- Kalshi settled YES at $0.26
- Polymarket settled YES at $1.00

An agent arbitraging both platforms lost on both sides simultaneously.
No rollback. No protection. CFTC complaint filed.

---

## What AgentVault Builds

Agent Settlement Protocol (ASP) - the first on-chain clearing house for AI agents on Solana.

Without AgentVault:
  Agent -> Buy YES $5K -> Swap USDC to SOL -> Reinvest
                OK           FAIL (slippage)
  Agent stuck with unwanted asset. No revert. Funds frozen.

With AgentVault ASP:
  Agent -> LOCK -> PRE-CHECK -> EXECUTE -> POST-CHECK -> SETTLE
                                      on any failure:
                                         REVERT -> full refund

---

## First Use Case: Prediction Markets

Prediction markets do $2B+ per week. 14 of 20 top traders are bots.
These bots have no clearing house. AgentVault is building it.

ASP wraps every agent strategy in a settlement envelope:
- Multi-step atomic execution: buy, claim, reinvest as one atomic transaction
- Cross-venue protection: Kalshi divergence triggers atomic revert
- Trust-weighted economics: on-chain reputation sets fee and collateral

---

## Settlement NFT - Key Innovation

Every position becomes a transferable Settlement NFT with embedded settlement logic.

  Settlement NFT = position + settlement conditions + trust metadata

The agent can sell the NFT without closing the position.
The buyer inherits the position AND all settlement guarantees.
PolicyController recalculates fee and collateral based on the new owner trust score.

No protocol has ever embedded settlement logic inside the position token itself.
Not CTF (Gnosis), not Augur, not Azuro.

---

## Trust-Weighted Economics (PolicyController)

  Trust 0-20   (new)          fee 0.75%  collateral 150%  credit $0
  Trust 21-50  (verified)     fee 0.50%  collateral 100%  credit $100
  Trust 51-80  (trusted)      fee 0.35%  collateral 50%   credit $1,000
  Trust 81-100 (institutional) fee 0.15% collateral 0%    credit $50,000

Fully algorithmic. No credit committee. No human in the loop.
On-chain reputation replaces trust.

Trust Flywheel:
More settlements -> Higher trust -> Lower fee + More credit -> More settlements

---

## Competitive Position

  Protocol        Oracle  Multi-step Atomic  Trust Economics  Agent Native  Chain
  UMA             YES     NO                 NO               NO            Ethereum
  Gnosis CTF      YES     NO                 NO               NO            Ethereum
  Augur v2        YES     NO                 NO               NO            Dead
  Azuro           YES     NO                 NO               partial SDK   Polygon
  Drift BET       YES     NO                 NO               partial API   Solana
  Polymarket      YES     NO                 NO               YES CLOB      Polygon
  AgentVault ASP  YES     YES atomic N-step  YES              YES MCP+A2A   Solana

---

## Tech Stack

  Smart contracts    Rust + Anchor 0.32.1
  Prediction market  Drift BET (Solana)
  DeFi routing       Raydium, Meteora
  Oracle             Pyth Network + Switchboard
  Position token     Metaplex Core (Settlement NFT)
  Agent interface    MCP Tools + Solana Actions (Blinks)
  Transaction cost   $0.00025

---

## Getting Started

  git clone https://github.com/Aleks-NFT/agent-settlement-protocol.git
  cd agent-settlement-protocol
  anchor build
  anchor test

---

## Docs

- docs/architecture.md - full system architecture
- docs/demo-script.md  - Agent Prediction Desk demo (5 min for judges)
- CLAUDE.md            - AI context and sprint plan

---

## Hackathon

Colosseum Frontier - April 6 to May 11, 2026 - Prize pool $2.5M
Superteam Ukraine Track - 10K USDG

Author: Piter @FirstNFT - Kyiv, Ukraine

"Trust -> Economic Enforcement -> Guaranteed Execution -> Credit Flywheel"
