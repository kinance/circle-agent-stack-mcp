# circle-agent-stack-mcp

MCP server for [Circle's Agent Stack](https://developers.circle.com/w3s/agent-stack) — create wallets, set spend policies, send USDC, and pay x402-priced endpoints, all from a tool call.

```bash
npx circle-agent-stack-mcp
```

## What this does

Circle launched the Agent Stack on May 11, 2026: Agent Wallets, Circle Gateway (x402 nanopayments), Circle Skills, and the Circle CLI. This MCP server exposes six tools that let any Claude-compatible agent drive the full stack:

| Tool | What it does |
|---|---|
| `circle_wallet_create` | Create an agent wallet (dev/hosted/smart) |
| `circle_wallet_list` | List wallets with USDC balances |
| `circle_balance` | Balance + last 10 txns for a wallet |
| `circle_policy_set` | Set daily cap, x402 cap, allow/block lists |
| `circle_transfer_usdc` | Send USDC to an on-chain address |
| `circle_x402_pay` | Pay an x402-priced endpoint and return its response |

## Quickstart

### Prerequisites

1. [Install the Circle CLI](https://developers.circle.com/w3s/agent-stack) and authenticate:
   ```bash
   npm install -g @circle-fin/circle-cli
   circle login
   ```

2. Set your API key:
   ```bash
   export CIRCLE_API_KEY=your_key_here
   ```

### Claude Desktop

Merge into `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "circle": {
      "command": "npx",
      "args": ["-y", "circle-agent-stack-mcp"],
      "env": {
        "CIRCLE_API_KEY": "your_key_here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add circle -- npx -y circle-agent-stack-mcp
```

Set `CIRCLE_API_KEY` in your shell environment or `.env`.

## Demo: Eva pays an x402 endpoint

Here's what the full flow looks like in Claude Desktop:

```
You: Create a dev wallet called eva-treasury, set a $5 daily cap and $0.10 x402 cap, then use it to fetch today's BTC signal from the x402 endpoint at https://signals.example.co/btc

Claude: 
→ circle_wallet_create("eva-treasury", type="dev")
  { wallet_id: "wal_abc123", address: "0x..." }

→ circle_policy_set("wal_abc123", daily_cap_usdc=5, x402_cap_usdc=0.10)
  { status: "applied" }

→ circle_x402_pay("wal_abc123", "https://signals.example.co/btc", max_price_usdc=0.10)
  { signal: "LONG", confidence: 0.72, price_paid_usdc: 0.05 }

Today's BTC signal: LONG (72% confidence). You paid $0.05 USDC.
```

The full cycle — wallet creation, policy, payment, data fetch — in one Claude conversation.

## Security

**Treat your Circle API key like a bank login.** This server has spend authority up to the policy limits you set. Always:

- Set a `daily_cap_usdc` before enabling automated payments.
- Start with `type="dev"` wallets for development and testing.
- Review the `allowlist` before moving to mainnet.
- Never commit your `CIRCLE_API_KEY` to version control.

## How it works

v0.1 shells out to the Circle CLI for all operations — this inherits Circle's auth handling and avoids re-implementing the API client. The MCP layer adds structured Zod validation and LLM-optimized tool descriptions on top.

v0.2 will switch to direct HTTP via `@circle-fin/circle-sdk` once the tool surface is validated by real usage.

## Roadmap

- [ ] `circle_nanopayment_stream` — streaming x402 payments for per-token billing
- [ ] `circle_skills_list` / `circle_skills_call` — access Circle Skills marketplace from Claude
- [ ] Direct HTTP API mode (v0.2) — remove CLI dependency
- [ ] Multi-chain support — EURC, CCTP cross-chain transfers

## Related

- [Circle Agent Stack docs](https://developers.circle.com/w3s/agent-stack)
- [x402 protocol](https://x402.org)
- [natural-mcp](../natural-mcp) — companion MCP for Natural agent-native payments
- [Model Context Protocol](https://modelcontextprotocol.io)
