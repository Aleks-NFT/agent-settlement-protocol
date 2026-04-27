# AgentVault MCP Setup

Wire AgentVault into Claude Desktop (or any MCP-compatible client) so an AI agent can drive the full settlement lifecycle — `initReputation → lock → preCheck → executeTrade → settle`, plus `revert` and factoring tools — directly from chat.

## Prerequisites

- Node.js ≥ 18
- A Solana wallet keypair at `~/.config/solana/id.json` (or set `WALLET_KEYPAIR`)
- Devnet SOL for transaction fees (`solana airdrop 2 --url devnet`)
- A USDC token account on devnet

## Step 1 — Build the server (local dev)

```bash
cd packages/mcp-server
npm install
npm run build
# Verify: node dist/index.js < /dev/null
```

## Step 2 — Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agentvault": {
      "command": "node",
      "args": ["/absolute/path/to/agent-settlement-protocol/packages/mcp-server/dist/index.js"],
      "env": {
        "SOLANA_CLUSTER": "devnet",
        "WALLET_KEYPAIR": "/Users/you/.config/solana/id.json"
      }
    }
  }
}
```

Once published to npm, replace with:

```json
{
  "mcpServers": {
    "agentvault": {
      "command": "npx",
      "args": ["-y", "agentvault-mcp-server"],
      "env": {
        "SOLANA_CLUSTER": "devnet",
        "WALLET_KEYPAIR": "/Users/you/.config/solana/id.json"
      }
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Step 3 — Verify

After restart, the following 11 tools should appear in Claude's tool list:

| Tool | Purpose |
|---|---|
| `initReputation` | Onboard agent — required once before any other tool |
| `lock` | Open settlement envelope, escrow USDC, mint Settlement NFT |
| `preCheck` | Validate Pyth price within tolerance + liquidity |
| `executeTrade` | Record fill price, release collateral |
| `postCheck` | Verify fill outcome against oracle |
| `settle` | Finalize, deduct fee, bump trust score |
| `revert` | Atomic rollback at any stage — full USDC refund |
| `listForSale` | List position for factoring (early exit) |
| `buySettlement` | Buy a listed Settlement NFT, inherit all guarantees |
| `openCreditBond` | Open credit line (trust score > 80 required) |
| `closeCreditBond` | Close credit bond and settle outstanding |

Quick sanity check via MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `SOLANA_CLUSTER` | `devnet` | `devnet` \| `mainnet-beta` \| `localnet` |
| `RPC_URL` | cluster default | Override RPC endpoint |
| `WALLET_KEYPAIR` | `~/.config/solana/id.json` | Agent keypair path |

## Program

- **Program ID:** `5SV1Q7yEff4jh5NkH48pTh5okh9mKAXXqdUMjfimWHVW`
- **Network:** Solana Devnet
- **IDL:** bundled at `packages/mcp-server/idl/agentvault.json`

## Example Claude Session

> "Initialize my reputation, then lock 1 USDC on a YES position with a 500-slot timeout."

Claude calls `initReputation` → then `lock` → returns `txSignature`, `settlementNft`, `marketId`, and an Explorer link.  
Follow up with `preCheck`, `executeTrade`, `postCheck`, and `settle` referencing the same `marketId`.
