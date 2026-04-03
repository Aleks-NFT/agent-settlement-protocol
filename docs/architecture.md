# AgentVault ASP — Architecture

## Core Concept

ASP operates as a settlement envelope around any agent strategy:

LOCK -> PRE-CHECK -> EXECUTE (N steps) -> POST-CHECK -> SETTLE
                          | (on failure at any step)
                       REVERT (atomic rollback)

## Accounts

### Settlement NFT
File: programs/agentvault/src/state/settlement.rs
- market_id, agent, position_type, amount
- pre_conditions, post_conditions, timeout_slot
- trust_score_at_entry, fee_bps, collateral_ratio
- status: Locked -> Executed -> Settled or Reverted
- transferable: bool (sell position without closing)

### SPL Reputation Account
File: programs/agentvault/src/state/reputation.rs
- trust_score: u8 (0-100)
- total_settlements, successful_settlements
- credit_limit, credit_bond

## PolicyController Logic

trust_score 0-20   -> fee 75bps,  collateral 150%, credit $0
trust_score 21-50  -> fee 50bps,  collateral 100%, credit $100
trust_score 51-80  -> fee 35bps,  collateral 50%,  credit $1,000
trust_score 81-100 -> fee 15bps,  collateral 0%,   credit $50,000

## Instructions

lock    | instructions/lock.rs    | Escrow USDC, mint Settlement NFT
execute | instructions/execute.rs | CPI to target program (Drift BET)
settle  | instructions/settle.rs  | Collect fee, update trust score
revert  | instructions/settle.rs  | Atomic rollback, full refund
policy  | instructions/policy.rs  | Compute fee/collateral from trust score

## Trust Flywheel

More settlements -> Higher trust -> Lower fee + More credit -> More settlements
