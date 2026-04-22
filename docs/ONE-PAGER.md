# Agent Settlement Protocol

**Atomic (all-or-nothing) clearing house for AI agents on Solana.**

Every agent strategy wrapped in an envelope that either completes atomically or reverts in full. No partial fills. No frozen funds. No false oracle resolutions.

---

## What We Built

Five-instruction atomic settlement envelope:

```
LOCK → PRE-CHECK → EXECUTE → POST-CHECK → SETTLE
                                         ↘ REVERT (any stage)
```

- **Trust-weighted PolicyController** — fee (0.15–0.75%) and collateral (0–150%) scale algorithmically with trust score 0–100. Fully algorithmic, no human-in-the-loop.
- **Settlement NFT** — position is transferable mid-flight. New owner inherits settlement guarantees; PolicyController recalculates terms for their trust tier.
- **Factoring** — `LIST_FOR_SALE` + `BUY_SETTLEMENT`: sell position at a discount before resolution. Atomic, one transaction.
- **Pyth-guarded pre-checks** — price tolerance, liquidity floor, and timeout slot validated on-chain before any execution.

---

## Why It's Hard

1. **Revival attack protection** — `vault.is_closed` flag set on execute; prevents resurrection of reverted vaults.
2. **Mid-flight ownership transfer** — Settlement NFT carries escrow PDA reference; `BUY_SETTLEMENT` swaps `current_owner` and inherits settlement guarantees for the new wallet.
3. **Atomic revert across multi-step chains** — REVERT is callable at any stage (Locked / PreChecked / Executed). Full escrow refund guaranteed.
4. **Algorithmic trust without governance** — PolicyController is pure math: no DAO vote, no admin override, no human approval path.

---

## Proof It Works

- **19/19 tests passing** (LiteSVM — in-process Solana VM, no validator needed)
- **3 version tags shipped:**
  - `v0.3.0-settle-green` — full LOCK→SETTLE lifecycle
  - `v0.3.1-precheck-pyth` — oracle-guarded pre-check + auto-revert on stale feed
  - `v0.4.0-factoring-green` — list_for_sale + buy_settlement
- **Live devnet transactions:**
  - lock: `5wMNuYAUyRZUq6TsAdUeFBLSzngffcYnUKzPKb5cqFXgJFxN7wzNNPo5ZjfbZdmcAyKcLEUMmmU7RSA85YYA8MZt`
  - [View lock TX on Solana Explorer](https://explorer.solana.com/tx/5wMNuYAUyRZUq6TsAdUeFBLSzngffcYnUKzPKb5cqFXgJFxN7wzNNPo5ZjfbZdmcAyKcLEUMmmU7RSA85YYA8MZt?cluster=devnet)
  - `list_for_sale`: `5sCMaHeRQZALwMS4tFe7J7yp1ZFJ8jwcJfPuEmviyAqpqzwfJcb1n9t2R5Z124JtJS43W2g9RxpDYDQ5bKs4gvMB`
  - `buy_settlement`: `3jgtf6NShro1afXL7JR4CsuJRcjUuPstLsTVzxoSgqJ3cQ8ikZX2d9TpLPzrsv17bG55X8vtEYnk98o8AebF9gwr`
- **Program ID:** `24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ` (devnet)
- **3 demo scripts:** `full-lifecycle.ts`, `factoring-flow.ts`, `oracle-failure.ts`
- **Test suite:** [`tests/agentvault-litesvm.ts`](tests/agentvault-litesvm.ts)

---

## Market

Three documented incidents that defined the gap:

| Incident | Loss | Root Cause | ASP Fix |
|---|---|---|---|
| UMA governance attack (2025) | $7M | False oracle resolution, no refund path | POST-CHECK + atomic revert |
| Super Bowl settlement divergence (2026) | Unresolved (both sides) | Same event: $0.26 vs $1.00 across venues | Cross-venue revert architecture |
| Drift hack (2026) | $285M | No atomic rollback, funds frozen | REVERT at any stage, full refund |

Wedge: prediction-market agents running multi-step strategies with zero recourse today.

---

## Team

Piter (@FirstNFT), Kyiv — solo builder. Five weeks, production Rust + Anchor.

---

## Try It

```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol
cd agent-settlement-protocol
npm install
npx ts-node --esm demo/full-lifecycle.ts
```

**GitHub:** [github.com/Aleks-NFT/agent-settlement-protocol](https://github.com/Aleks-NFT/agent-settlement-protocol)
