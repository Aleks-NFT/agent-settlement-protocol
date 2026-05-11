<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./readme-hero-dark.svg">
  <img alt="ASP Project Hero" src="./readme-hero-light.svg">
</picture>

# Agent Settlement Protocol (ASP)

**The Clearing House for AI Agents on Solana**

> *The market is building Venmo for agents. AgentVault builds their DTCC.*

[![Tests](https://github.com/Aleks-NFT/agent-settlement-protocol/actions/workflows/test.yml/badge.svg)](https://github.com/Aleks-NFT/agent-settlement-protocol/actions/workflows/test.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Built on Solana](https://img.shields.io/badge/Built%20on-Solana-9945FF)](https://solana.com) [![Colosseum Frontier](https://img.shields.io/badge/Hackathon-Colosseum%20Frontier%202026-blue)](https://colosseum.com/frontier) [![Devnet](https://img.shields.io/badge/Devnet-live-9945FF)](https://explorer.solana.com/address/5SV1Q7yEff4jh5NkH48pTh5okh9mKAXXqdUMjfimWHVW?cluster=devnet)

[📄 Pitch Deck](https://drive.google.com/file/d/1xFUaudiyENTmcqgk1DHrq6G2OHlhn-C6/view) • [🔗 Program on Devnet](https://explorer.solana.com/address/24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ?cluster=devnet) • [🎬 Demo](#demo-scripts)

---
## Hackathon Quickstart

> **Required:** `cargo-build-sbf` with platform-tools ≥ v1.54, `anchor-cli` 0.32.x, `node` ≥ 18, `yarn`.
> Run `yarn check:env` to verify your environment before building.

```bash
yarn install
yarn build:hackathon   # compile SBF + generate IDL + generate TS types
yarn test:hackathon    # build then run full LiteSVM test suite
```

**Why not `anchor build`?** The standard pipeline defaults to platform-tools v1.48 (rustc 1.84),
which rejects crates requiring `edition2024` pulled transitively through the dependency graph.
`build:hackathon` explicitly passes `--tools-version v1.54` and handles IDL generation separately.

```bash
# One-line env check
bash scripts/check-env.sh
```

---

## Use from Claude Desktop / Cursor

Any Claude or Cursor user can plug Agent Settlement Protocol into their AI workflow in one command:

```bash
npx agentvault-mcp-server
```

Or add to `claude_desktop_config.json` for permanent access:

```json
{
  "mcpServers": {
    "agentvault": {
      "command": "npx",
      "args": ["-y", "agentvault-mcp-server"],
      "env": { "SOLANA_CLUSTER": "devnet" }
    }
  }
}
```

**Available tools:** `lock` · `preCheck` · `executeTrade` · `postCheck` · `settle` · `revert` · `listForSale` · `openCreditBond` · `closeCreditBond` · `initReputation` · `buySettlement`

[Full setup guide →](./docs/MCP-SETUP.md)

---

## The Problem

The market is solving Oracle Problem: who decides what happened.
Nobody is solving Settlement Problem: what happens AFTER the oracle decides, for AI agents running complex multi-step strategies.

### Real Failures That Prove This

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

**UMA Capital Asymmetry - structural (ongoing 2025-2026)**
UMA's Optimistic Oracle imposes a 750 USDC bond + 4-day window for any disputer.
$7M attacker profit > $750 defender cost = mathematical certainty of capital
attacks. The dispute mechanism rewards attackers proportionally more than
defenders.
Root cause: no post-condition verification AFTER oracle resolves. ASP adds
on-chain post_check that runs INSIDE the same transaction as settlement.

---

## What ASP Builds

Agent Settlement Protocol (ASP) - the first on-chain clearing house for AI agents on Solana.

**Without Agent Settlement Protocol:**
Agent -> Buy YES $5K -> Swap USDC to SOL -> Reinvest
OK FAIL (slippage)
Agent stuck with unwanted asset. No revert. Funds frozen.

**With Agent Settlement Protocol ASP:**
Agent -> LOCK -> PRE-CHECK -> EXECUTE -> SETTLE
on any failure:
REVERT -> full refund

---

## First Use Case: Prediction Markets

Prediction markets do $2B+ per week. 70%+ of prediction market volume is automated.
These bots have no clearing house. AgentVault is building it.

ASP wraps every agent strategy in a settlement envelope:
- **Cross-venue protection** - Kalshi divergence triggers atomic revert across venues
- **Trust-weighted economics** - on-chain reputation sets fee and collateral
- **Verified settlement** - multi-step atomic execution with on-chain Pyth pre-check

---

## Settlement NFT - Key Innovation

Every position becomes a transferable Settlement NFT with embedded settlement logic.

```
Settlement NFT = position + settlement conditions + trust metadata
```

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
```
More settlements -> Higher trust -> Lower fee + Less collateral -> More settlements
```

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
|  **Agent Settlement Protocol** | **YES** | **YES atomic N-step** | **YES** | **YES MCP+A2A** | **Solana** |

---

## Program

| | |
|---|---|
| **Program ID** | `5SV1Q7yEff4jh5NkH48pTh5okh9mKAXXqdUMjfimWHVW` |
| **Network** | Solana Devnet |
| **Framework** | Anchor 0.32.1 |
| **Tests** | 32/32 passing |
| **Explorer** | https://explorer.solana.com/address/5SV1Q7yEff4jh5NkH48pTh5okh9mKAXXqdUMjfimWHVW?cluster=devnet |

---

## Quickstart

### Prerequisites

```bash
node >= 20
anchor >= 0.32
solana-cli >= 1.18
```

### Setup

```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol.git
cd agent-settlement-protocol
yarn install
```

### Run Tests (33/33)

```bash
yarn test:hackathon   # build SBF + run full LiteSVM suite
```

### Run Live Demo on Devnet

```bash
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

npx ts-node --esm demo/full-lifecycle.ts
```

Expected output:
```
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
```

---


## Demo Scripts

### Happy Path - Full Lifecycle

```bash
export ANCHOR_WALLET=~/.config/solana/id.json
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
npx ts-node --esm demo/full-lifecycle.ts
```

7 steps on live devnet: lock → preCheck → execute → settle. Trust flywheel in action: 50 → 51 → 53.

### 🔴 Oracle Failure - Protection Demo

```bash
npx ts-node --esm demo/oracle-failure.ts
```

Scenario: invalid Pyth feed → `preCheck` rejected on-chain → agent calls `revert` → **full USDC refund, zero agent loss**.

3️⃣ Lock - escrow 1,000 USDC
✅ Status: locked
✅ Agent balance: 4,000 USDC (1,000 in escrow)

4️⃣ PreCheck - invalid feed → expects on-chain rejection
❌ PreCheck TX: REJECTED - oracle validation failed
✅ Error code: PriceStale
✅ USDC: still locked safely in vault

5️⃣ Revert - agent triggers full refund
✅ Status: reverted
✅ Refunded: 1,000 USDC - full escrow returned
✅ Agent loss: 0 USDC

> Without ASP → funds frozen (see UMA $7M governance attack, Kalshi/Polymarket divergence)
> With ASP    → oracle fails → auto revert → full refund

## Security

- **PDA authority** - vault USDC can only be moved by vault PDA signer seeds
- **Revival attack protection** - `vault.is_closed = true` prevents double-spend
- **Timeout enforcement** - `timeout_slot` checked on every instruction
- **Arithmetic safety** - all math via `checked_*` ops, zero unchecked overflow
- **Pyth validation** - magic bytes `0xa1b2c3e4`, staleness <=1h, confidence <=2%

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Rust + Anchor 0.32.1 |
| Oracle | Pyth Network (raw binary feed parser) |
| Testing | LiteSVM (32/32 tests) |
| Agent interface | MCP Tools + Solana Actions (Blinks) |
| Transaction cost | $0.00025 |

---

## Roadmap

| Milestone | Status |
|---|---|
| Core state machine (lock / revert / preCheck / execute / settle) | Done |
| Pyth price feed integration | Done |
| Reputation + PolicyController | Done |
| 32/32 LiteSVM tests | Done |
| Devnet deploy | Done |
| Live demo script | Done |
| Post-check instruction | Done |
| Multi-agent batch settlement | Next |
| Mainnet deploy | Post-hackathon |

---

## Hackathon

📄 **[Pitch Deck (Google Slides)](https://drive.google.com/file/d/1xFUaudiyENTmcqgk1DHrq6G2OHlhn-C6/view)**


**Colosseum Frontier** - April 6 to May 11, 2026 - Prize pool $2.5M
**Superteam Ukraine Track** - 10K USDG

Author: Aleks @FirstNFT - Kyiv, Ukraine

> *"Trust -> Economic Enforcement -> Guaranteed Execution -> Credit Flywheel"*

---

## License

MIT 2026 AgentVault

---

## Early Exit Flow (Factoring)

Bot A opens a position but needs liquidity before resolution - sells the Settlement NFT to Bot B at a 3% discount. Atomic, on-chain, one transaction.
```text
┌─────────────────────────────────────────────────────┐
│ Bot A: LOCK → Settlement NFT minted │
│ Bot A: LIST_FOR_SALE → ask_price = 0.97 USDC │
│ Bot B: BUY_SETTLEMENT → becomes new owner │
│ Vault collateral follows the NFT automatically │
└─────────────────────────────────────────────────────┘
```
### Run the demo

```bash
npx ts-node --esm demo/factoring-flow.ts
```

Requires a funded devnet wallet at `~/.config/solana/id.json`.  
Prints live Solana Explorer links for every transaction.

### Live devnet proof

- TX lock: `5wMNuYAUyRZUq6TsAdUeFBLSzngffcYnUKzPKb5cqFXgJFxN7wzNNPo5ZjfbZdmcAyKcLEUMmmU7RSA85YYA8MZt`
- TX list\_for\_sale: `5sCMaHeRQZALwMS4tFe7J7yp1ZFJ8jwcJfPuEmviyAqpqzwfJcb1n9t2R5Z124JtJS43W2g9RxpDYDQ5bKs4gvMB`
- TX buy\_settlement: `3jgtf6NShro1afXL7JR4CsuJRcjUuPstLsTVzxoSgqJ3cQ8ikZX2d9TpLPzrsv17bG55X8vtEYnk98o8AebF9gwr`

## Quick Start (devnet, 3 commands)

```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol
cd agent-settlement-protocol
npm install
npx ts-node --esm demo/full-lifecycle.ts
```
