# circle-agent-stack-mcp

MCP server for [Circle's Agent Stack](https://developers.circle.com/agent-stack). Create wallets, set spend policies, send USDC, and pay x402-priced endpoints — all from a tool call.

```bash
npx circle-agent-stack-mcp
```

## Tools

| Tool | What it does |
|---|---|
| `circle_wallet_create` | Create an agent wallet (dev/hosted/smart) |
| `circle_wallet_list` | List wallets with USDC balances |
| `circle_balance` | Balance + last 10 txns for a wallet |
| `circle_policy_set` | Set daily cap, x402 cap, allow/block lists |
| `circle_transfer_usdc` | Send USDC to an on-chain address |
| `circle_x402_pay` | Pay an x402-priced endpoint and return its response |

## Quickstart

You need the Circle CLI installed and authenticated:

```bash
npm install -g @circle-fin/circle-cli
circle login
export CIRCLE_API_KEY=your_key_here
```

### Claude Desktop

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

## Example

```
You: Create a dev wallet called eva-treasury, set a $5 daily cap and $0.10 x402 cap,
     then fetch today's BTC signal from the x402 endpoint at https://signals.example.co/btc

Claude:
→ circle_wallet_create("eva-treasury", type="dev")
  { wallet_id: "wal_abc123", address: "0x..." }

→ circle_policy_set("wal_abc123", daily_cap_usdc=5, x402_cap_usdc=0.10)
  { status: "applied" }

→ circle_x402_pay("wal_abc123", "https://signals.example.co/btc", max_price_usdc=0.10)
  { signal: "LONG", confidence: 0.72, price_paid_usdc: 0.05 }

Today's BTC signal: LONG (72% confidence). Paid $0.05.
```

## Self-hosting with x402 paywall

`http-server.ts` wraps the same tools behind an x402 paywall — agents pay per call in USDC rather than using an API key. Useful if you want to expose Circle tooling as a paid service.

```bash
CIRCLE_PAYOUT_ADDRESS=0x... npm run start:http
```

To test the x402 flow locally, run the toy demo server in `examples/x402-demo-server.mjs`.

## How it works

v0.1 shells out to the Circle CLI for all operations. This keeps auth handling out of this repo and avoids reimplementing the API client before the tool surface is validated. v0.2 will switch to direct HTTP via `@circle-fin/circle-sdk`.

## Security

Your Circle API key has spend authority. Always:

- Set `daily_cap_usdc` before enabling automated payments
- Start on `type="dev"` wallets, not mainnet
- Review the `allowlist` before moving to production
- Don't commit `CIRCLE_API_KEY`

## Roadmap

- [ ] `circle_nanopayment_stream` — streaming x402 payments for per-token billing
- [ ] `circle_skills_list` / `circle_skills_call` — Circle Skills marketplace
- [ ] Direct HTTP API mode (v0.2) — remove CLI dependency
- [ ] Multi-chain — EURC, CCTP cross-chain transfers

## Related

- [Circle Agent Stack docs](https://developers.circle.com/w3s/agent-stack)
- [x402 protocol](https://x402.org)
- [Model Context Protocol](https://modelcontextprotocol.io)
