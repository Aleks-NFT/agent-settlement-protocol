# AgentVault MCP Setup

Wire AgentVault into Claude Desktop (or any MCP-compatible client) so an agent can drive the full settlement envelope — `lock → preCheck → executeTrade → settle`, plus `revert` and `listForSale` — from chat.

## Prerequisites

- Node.js ≥ 20
- A Solana wallet funded on devnet (`solana airdrop 2`)
- An agent USDC token account on devnet (use `spl-token create-account` against the devnet USDC mint)

## 1. Install

```bash
# From a published release (once live)
npm install -g @agentvault/mcp-server

# Or, during development, from this repo
cd packages/mcp-server
npm install
npm run build
```

## 2. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "agentvault": {
      "command": "npx",
      "args": ["-y", "@agentvault/mcp-server"],
      "env": {
        "SOLANA_CLUSTER": "devnet",
        "WALLET_KEYPAIR": "/Users/you/.config/solana/id.json"
      }
    }
  }
}
```

During local development, point directly at the built entry:

```json
{
  "mcpServers": {
    "agentvault": {
      "command": "node",
      "args": ["/absolute/path/to/agent-settlement-protocol/packages/mcp-server/dist/index.js"],
      "env": {
        "SOLANA_CLUSTER": "devnet"
      }
    }
  }
}
```

## 3. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `SOLANA_CLUSTER` | `devnet` | `devnet` \| `mainnet-beta` \| `testnet` \| `localnet` |
| `RPC_URL` | cluster default | Override the RPC endpoint |
| `WALLET_KEYPAIR` | `~/.config/solana/id.json` | Path to the agent's keypair JSON file |

## 4. Verify

Restart Claude Desktop. The six tools should appear in the MCP tool list:

- `lock` — open a settlement envelope, escrow USDC, mint Settlement NFT
- `preCheck` — validate Pyth price within tolerance + liquidity + timeout
- `executeTrade` — fill at observed price, record outcome
- `settle` — finalize, deduct fee, return collateral, bump trust score
- `revert` — abort at any stage, full refund, trust −1
- `listForSale` — list the locked position for factoring (early exit)

Quick sanity check from the MCP inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## 5. Example Session

Ask Claude:

> Lock a 1 USDC YES position on BTC-Apr26 with a 500-slot timeout. My agent USDC is at `<token-account>`.

Claude calls `lock` → returns `txSignature`, `settlementNft`, `marketId`, and an Explorer link. Follow up with `preCheck`, `executeTrade`, and `settle` referencing the same `marketId`.

## Program ID

`24ieTtzuXd4iA2KwcsyHK4qyUFXgmVPhVNadThVmSvGJ` (devnet + localnet). The server loads the IDL from `packages/mcp-server/idl/agentvault.json` at runtime — regenerate it with `anchor build` and the `prepublishOnly` hook will copy it into the package before publish.
