#!/usr/bin/env node
/**
 * Toy x402 demo server for circle-agent-stack-mcp local testing.
 *
 * Returns a mock BTC signal behind a $0.001 USDC paywall so you can test
 * the circle_x402_pay tool without a live data vendor.
 *
 * Usage:
 *   CDP_API_KEY=your_key PAYOUT_ADDRESS=0x... node examples/x402-demo-server.mjs
 *
 * Then in Claude:
 *   circle_x402_pay(wallet_id="wal_...", endpoint_url="http://localhost:3001/btc-signal", max_price_usdc=0.01)
 */

import express from "express";
import { paymentMiddleware } from "@x402/express";

const PORT = parseInt(process.env.PORT ?? "3001");
const PAYOUT_ADDRESS = process.env.PAYOUT_ADDRESS;
const CDP_API_KEY = process.env.CDP_API_KEY;

if (!PAYOUT_ADDRESS || !CDP_API_KEY) {
  console.error("PAYOUT_ADDRESS and CDP_API_KEY env vars are required");
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use(
  paymentMiddleware(
    PAYOUT_ADDRESS,
    {
      "GET /btc-signal": {
        price: "$0.001",
        network: "eip155:8453",
        description: "Mock BTC directional signal",
      },
    },
    { cdpApiKey: CDP_API_KEY }
  )
);

app.get("/btc-signal", (_req, res) => {
  res.json({
    signal: "LONG",
    confidence: 0.72,
    generated_at: new Date().toISOString(),
    source: "circle-agent-stack-mcp demo",
  });
});

app.listen(PORT, () => {
  console.log(`x402 demo server on :${PORT}`);
  console.log(`  endpoint: http://localhost:${PORT}/btc-signal  ($0.001 USDC)`);
});
