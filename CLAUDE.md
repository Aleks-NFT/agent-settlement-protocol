# AgentVault — CLAUDE.md
> Agent Settlement Protocol (ASP) on Solana
> "The DTCC for AI Agents"
> Hackathon: Colosseum Frontier | April 6 – May 11, 2026

## Vision
AgentVault is the Settlement Intelligence layer missing from the AI agent economy.
The market builds payment rails (Venmo for agents). We build the Clearing House (DTCC for agents).

## Architecture
- Layer 1: Execution (Tensor, Raydium, Meteora) — not ours, our wedge
- Layer 2: ASP Core — LOCK → PRE-CHECK → EXECUTE → POST-CHECK → SETTLE/REVERT
- Layer 3: PolicyController — trust score → fee/collateral/credit limits

## Tech Stack
- Smart contracts: Rust + Anchor
- Payment: Solana Actions (Blinks)
- Oracle: Pyth Network
- NFT: Tensor | DeFi: Raydium, Meteora
- Stablecoin: USDC (SPL)

## Trust Tiers
- 0-20: fee 0.75%, collateral 150%, credit $0
- 21-50: fee 0.50%, collateral 100%, credit $100
- 51-80: fee 0.35%, collateral 50%, credit $1,000
- 81-100: fee 0.15%, collateral 0%, credit $50,000

## Coding Rules
- Write production-ready Rust/Anchor, not pseudocode
- All errors via custom AgentVaultError enum
- Every settlement MUST be atomic — all steps or full revert
- PolicyController is fully algorithmic — no human-in-the-loop
- No own DEX, no own token in MVP

## What NOT to build in MVP
- No DAO governance
- No ZKP (V2 roadmap)
- No cross-chain (V2 roadmap)
- No complex UI

## Sprint Plan
- Week 1 (Apr 6-12): ASP v0.1 lock → execute (1 step) → settle/revert
- Week 2 (Apr 13-19): 3-step chain + Tensor/Raydium
- Week 3 (Apr 20-26): SPL Reputation + PolicyController (3 tiers)
- Week 4 (Apr 27-May 3): Credit Bond + Deferred Settlement
- Week 5 (May 4-11): Demo polish + pitch

## Owner
Piter (@FirstNFT), Kyiv | Status: MVP build for Colosseum Frontier 2026

## Design System
See [DESIGN.md](./DESIGN.md) for full token system, typography rules, component patterns and anti-patterns.
All Claude sessions building AgentVault UI must load this file before generating any visual output.
