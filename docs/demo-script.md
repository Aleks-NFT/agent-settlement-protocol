# Demo Script: Agent Prediction Desk

## Scenario (5 min for judges)

AI agent finds: Drift BET prices event X at 45%, agent estimates real = 72%.
Opens YES position $500 USDC through ASP.

## Without AgentVault

Agent -> Buy YES $500 -> Swap to reinvest -> FAIL (slippage)
Agent stuck. No revert. Funds partially frozen.

## With AgentVault ASP

Step 1: LOCK
- Transfer $500 USDC + $250 collateral -> escrow PDA
- Mint Settlement NFT (trust_score=72, fee=0.35%, collateral=50%)

Step 2: PRE-CHECK
- Drift BET market active OK
- Price 0.45 within tolerance OK
- Liquidity sufficient OK

Step 3: EXECUTE via CPI to Drift BET
- buy_yes($500, limit=0.48)
- actual_fill = 0.461 OK

Step 4: POST-CHECK
- YES tokens received OK
- Escrow intact OK

Step 5a: SETTLE (success path)
- Fee: $500 x 0.0035 = $1.75 -> treasury
- Collateral $250 -> returned to agent
- trust_score: 72 -> 73
- Settlement NFT status = SETTLED

Step 5b: REVERT (on any failure)
- Sell YES tokens back on Drift BET
- Return all $750 (amount + collateral) -> agent
- Settlement NFT status = REVERTED, reason logged

## Key Demo Moment

Between Step 1 and Step 5 the agent can SELL the Settlement NFT.
New owner inherits position AND all settlement guarantees.
First protocol to embed settlement logic inside the position token.

## Real Failure Cases (use in pitch)

Case 1 - UMA Governance Attack March 2025:
Whale with $20M in UMA tokens forced false resolution on Polymarket.
$7M stolen from correct predictors. No refund. Irreversible.
ASP fix: post-condition verification requires N oracle sources before unlock.

Case 2 - Cardi B Super Bowl February 2026:
Same event. $57M volume total.
Kalshi: YES = $0.26. Polymarket: YES = $1.00.
Agent arbitraging both lost on both sides.
ASP fix: cross-venue atomic revert if outcomes diverge.
