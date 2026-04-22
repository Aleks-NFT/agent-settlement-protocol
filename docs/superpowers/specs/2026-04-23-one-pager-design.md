# One-Pager Design Spec — Agent Settlement Protocol
> Colosseum Frontier 2026 | Audience: Hackathon Judges (Technical)

## Deliverables

| File | Purpose |
|---|---|
| `docs/ONE-PAGER.md` | Markdown source — GitHub-renderable, linkable |
| `docs/one-pager.html` | Styled HTML — embeds DESIGN.md tokens, print → PDF |

Both files carry identical content. HTML is the presentation layer.

---

## Structure: Technical Innovation First

### 1. Hook
**Headline:** `Agent Settlement Protocol`
**Tagline:** Atomic clearing house for AI agents on Solana.
**Sub:** Every agent strategy wrapped in an envelope that either completes atomically or reverts in full. No partial fills. No frozen funds. No false oracle resolutions.

### 2. What We Built
Five-instruction atomic settlement envelope:

```
LOCK → PRE-CHECK → EXECUTE → POST-CHECK → SETTLE
                                         ↘ REVERT (any stage)
```

- **Trust-weighted PolicyController** — fee (0.15–0.75%) and collateral (0–150%) scale algorithmically with trust score 0–100. No human-in-the-loop.
- **Settlement NFT (Metaplex Core)** — position is transferable mid-flight. New owner inherits settlement guarantees; PolicyController recalculates terms for their trust tier.
- **Factoring** — `LIST_FOR_SALE` + `BUY_SETTLEMENT`: Bot A sells position at a discount to Bot B before resolution. Atomic, one transaction.
- **Pyth-guarded pre-checks** — price tolerance, liquidity floor, timeout slot validated before any execution.

### 3. Why It's Hard
Four non-obvious engineering constraints:

1. **Revival attack protection** — `vault.is_closed` flag set on execute; prevents resurrection of reverted vaults.
2. **Mid-flight ownership transfer** — Settlement NFT carries escrow PDA reference; buy_settlement swaps `current_owner` and inherits `trust_score_at_entry` pricing for the new wallet.
3. **Atomic revert across multi-step chains** — REVERT callable at any stage (Locked / PreChecked / Executed). Full escrow refund guaranteed. Trust score penalized algorithmically (−1).
4. **Algorithmic trust without governance** — PolicyController is pure math: no DAO vote, no admin override, no human approval.

### 4. Proof It Works
Hard numbers only — all on-chain-verifiable or in-repo:

- **19/19 tests passing** (LiteSVM — in-process Solana VM, no validator needed)
- **3 version tags shipped:**
  - `v0.3.0-settle-green` — full LOCK→SETTLE lifecycle
  - `v0.3.1-precheck-pyth` — oracle-guarded pre-check + auto-revert on stale feed
  - `v0.4.0-factoring-green` — list_for_sale + buy_settlement
- **3 live devnet TX hashes** (lock, list_for_sale, buy_settlement) — Solana Explorer links
- **3 demo scripts:** `full-lifecycle.ts`, `factoring-flow.ts`, `oracle-failure.ts`
- **Program ID:** `FfAjYkk4ktD3iHkF7jNes2p7EBZUR1mwBrbK4fGC3QXe` (devnet)

### 5. Market
Three documented incidents that define the gap:

| Incident | Loss | Root Cause | ASP Fix |
|---|---|---|---|
| UMA governance attack (2025) | $7M | False oracle resolution, no refund | POST-CHECK + atomic revert |
| Super Bowl divergence (2026) | Bilateral | Same event, $0.26 vs $1.00 across venues | Cross-venue revert architecture |
| Drift hack (2026) | $285M | No atomic rollback, funds frozen | REVERT at any stage, full refund |

Wedge: prediction-market agents ($4B TAM) running multi-step strategies with zero recourse today.

### 6. Team
Piter (@FirstNFT) — solo builder, Kyiv. Five weeks, production Rust + Anchor.

### 7. Try It
```bash
git clone https://github.com/Aleks-NFT/agent-settlement-protocol
cd agent-settlement-protocol
npm install
npx ts-node --esm demo/full-lifecycle.ts
```
GitHub: `github.com/Aleks-NFT/agent-settlement-protocol`

---

## Visual Spec (HTML only)

### Tokens (from DESIGN.md)
- Background: `#0a0a0a` base, `#111111` surface, `#1a1a1a` elevated
- Accent: `#4ade80` (green) — borders, badges, code highlights
- Text: `#ffffff` primary, `#d1d5db` secondary, `#6b7280` muted
- Fonts: Inter (prose), JetBrains Mono (code/hashes/amounts/IDs)

### Layout
- Single column, `max-width: 720px`, centered
- `--space-3` (12px) section padding — dense, Bloomberg-terminal density
- Section dividers: `1px solid #2a2a2a` hairlines, no block separators
- Print-optimized: fits ~1 printed page at 90% zoom; primary read is first screen

### Component usage
- Status badges: `SETTLED` (green), `LOCKED` (blue), `REVERTED` (red) — used as visual anchors in "What We Built"
- Code block: `border-left: 3px solid #4ade80`, dark background — used for enrollment flow and Try It
- Data table: for incidents (Market section)
- TX hashes and program ID: always `font-family: JetBrains Mono`

### Anti-patterns (forbidden per DESIGN.md)
No gradients. No illustrations. No emoji. No shadows. No `border-radius > 6px`. No color outside black/white/green palette.

---

## Out of Scope
- Investor pitch deck (separate deliverable)
- Interactive demo embed
- Light mode variant
