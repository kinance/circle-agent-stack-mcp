#!/usr/bin/env node
import express, { Request, Response } from "express";
import { z } from "zod";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { walletTools } from "./tools/wallet.js";
import { transferTools } from "./tools/transfer.js";
import { x402Tools } from "./tools/x402.js";

const PAYOUT_ADDRESS = process.env.CIRCLE_PAYOUT_ADDRESS;
const PORT = parseInt(process.env.PORT ?? "3402");
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? "https://facilitator.x402.org";

if (!PAYOUT_ADDRESS) {
  console.error("CIRCLE_PAYOUT_ADDRESS environment variable is required");
  process.exit(1);
}
if (!process.env.CIRCLE_API_KEY) {
  console.error("CIRCLE_API_KEY environment variable is required");
  process.exit(1);
}

const BASE_MAINNET = "eip155:8453" as const;

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(
  BASE_MAINNET,
  new ExactEvmScheme()
);

const routes = {
  "POST /tools/circle_wallet_create": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.01",
      network: BASE_MAINNET,
      payTo: PAYOUT_ADDRESS,
    },
    description: "Create a new Circle Agent Wallet",
  },
  "POST /tools/circle_transfer_usdc": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.05",
      network: BASE_MAINNET,
      payTo: PAYOUT_ADDRESS,
    },
    description: "Transfer USDC to any address via Circle Agent Wallet",
  },
  "POST /tools/circle_x402_pay": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.02",
      network: BASE_MAINNET,
      payTo: PAYOUT_ADDRESS,
    },
    description: "Preflight + pay any x402-gated endpoint",
  },
};

const app = express();
app.use(express.json());
app.use(paymentMiddleware(routes, resourceServer));

type AnyTool = {
  name: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (input: unknown) => Promise<unknown>;
};

function registerTool(toolList: AnyTool[], toolName: string, path: string): void {
  const tool = toolList.find((t) => t.name === toolName);
  if (!tool) {
    console.error(`Tool not found: ${toolName}`);
    return;
  }
  app.post(path, async (req: Request, res: Response) => {
    try {
      const parsed = tool.schema.parse(req.body);
      const result = await tool.handler(parsed);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.errors });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}

registerTool(walletTools as AnyTool[], "circle_wallet_create", "/tools/circle_wallet_create");
registerTool(transferTools as AnyTool[], "circle_transfer_usdc", "/tools/circle_transfer_usdc");
registerTool(x402Tools as AnyTool[], "circle_x402_pay", "/tools/circle_x402_pay");

// Bazaar discovery manifest
app.get("/services.json", (_req: Request, res: Response) => {
  const host = _req.get("host") ?? `localhost:${PORT}`;
  res.json({
    id: "circle-agent-stack-mcp",
    name: "Circle Agent Stack MCP",
    description: "USDC wallets, transfers, and x402 micropayments for AI agents via Circle Agent Wallet",
    version: "0.1.0",
    x402Version: "1.0",
    networks: [BASE_MAINNET],
    category: "payments",
    tags: ["circle", "usdc", "x402", "mcp", "agent-payments", "stablecoin"],
    endpoints: [
      { path: "/tools/circle_wallet_create", method: "POST", price: "$0.01" },
      { path: "/tools/circle_transfer_usdc", method: "POST", price: "$0.05" },
      { path: "/tools/circle_x402_pay", method: "POST", price: "$0.02" },
    ],
    docs: "https://github.com/kinance/circle-agent-stack-mcp",
    llms: `http://${host}/llms.txt`,
  });
});

// llms.txt for AI crawler indexing
app.get("/llms.txt", (_req: Request, res: Response) => {
  res.type("text/plain").send(
    `# circle-agent-stack-mcp

MCP server and HTTP API for Circle Agent Wallet: create USDC wallets, transfer stablecoin,
and pay any x402-gated endpoint. Built for autonomous AI agents using Model Context Protocol.

## Tools
- POST /tools/circle_wallet_create — Create a Circle Agent Wallet ($0.01/call)
- POST /tools/circle_transfer_usdc — Transfer USDC (wallet_id, to_address, amount_usdc) ($0.05/call)
- POST /tools/circle_x402_pay — Preflight + pay x402 endpoint (wallet_id, endpoint_url, max_price_usdc) ($0.02/call)

## Auth
x402 payment required. Pay via USDC on Base mainnet (eip155:8453). No API key needed.

## Source
https://github.com/kinance/circle-agent-stack-mcp
`
  );
});

app.listen(PORT, () => {
  console.log(`circle-agent-stack-mcp HTTP server on :${PORT}`);
  console.log(`  services: http://localhost:${PORT}/services.json`);
  console.log(`  llms.txt: http://localhost:${PORT}/llms.txt`);
});
