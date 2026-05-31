#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { walletTools } from "./tools/wallet.js";
import { policyTools } from "./tools/policy.js";
import { transferTools } from "./tools/transfer.js";
import { x402Tools } from "./tools/x402.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

if (!process.env.CIRCLE_API_KEY) {
  console.error("CIRCLE_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

type AnyTool = {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (input: any) => Promise<unknown>;
};

const allTools: AnyTool[] = [
  ...walletTools,
  ...policyTools,
  ...transferTools,
  ...x402Tools,
];

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape,
    async (input) => {
      try {
        const result = await tool.handler(input);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
