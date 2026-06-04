/**
 * End-to-end tests for circle-agent-stack-mcp.
 *
 * Spawns the real compiled MCP server as a child process and communicates
 * over stdio using the JSON-RPC protocol. No mocks — exercises the full
 * path from raw bytes through Zod validation to CLI invocation (which
 * errors with ENOENT since the Circle CLI isn't installed here, but that
 * proves the full pipeline is wired up).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const SERVER_PATH = resolve(import.meta.dirname!, "../dist/server.js");

// Helper: manages a server process and provides send/receive over JSON-RPC
class McpClient {
  private proc: ChildProcess;
  private buffer = "";
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor() {
    this.proc = spawn("node", [SERVER_PATH], {
      env: { ...process.env, CIRCLE_API_KEY: "e2e-test-key" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.proc.stdout!.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      // MCP uses newline-delimited JSON
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop()!; // keep incomplete last line
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id != null && this.pending.has(msg.id)) {
            this.pending.get(msg.id)!.resolve(msg);
            this.pending.delete(msg.id);
          }
        } catch {
          // ignore non-JSON lines (e.g. startup messages)
        }
      }
    });
  }

  async initialize(): Promise<unknown> {
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e-test", version: "1.0" },
    });
    // Send initialized notification (no response expected)
    this.notify("notifications/initialized");
    return result;
  }

  async request(method: string, params?: unknown): Promise<any> {
    const id = this.nextId++;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      this.proc.stdin!.write(msg + "\n");
    });
  }

  notify(method: string, params?: unknown): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} });
    this.proc.stdin!.write(msg + "\n");
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    return this.request("tools/call", { name, arguments: args });
  }

  async close(): Promise<void> {
    this.proc.stdin!.end();
    return new Promise((resolve) => {
      this.proc.on("close", () => resolve());
      setTimeout(() => { this.proc.kill(); resolve(); }, 3000);
    });
  }
}

describe("E2E: MCP server lifecycle", () => {
  let client: McpClient;

  beforeAll(async () => {
    client = new McpClient();
  });

  afterAll(async () => {
    await client.close();
  });

  // ── Handshake ──

  it("completes the initialize handshake", async () => {
    const msg: any = await client.initialize();
    expect(msg.result.protocolVersion).toBe("2024-11-05");
    expect(msg.result.serverInfo.name).toBe("circle-agent-stack-mcp");
    expect(msg.result.serverInfo.version).toBe("0.1.3");
    expect(msg.result.capabilities.tools).toBeDefined();
  });

  // ── Tool discovery ──

  it("lists all 6 tools with correct schemas", async () => {
    const msg: any = await client.request("tools/list");
    const tools = msg.result.tools;
    expect(tools).toHaveLength(6);

    const names = tools.map((t: any) => t.name).sort();
    expect(names).toEqual([
      "circle_balance",
      "circle_policy_set",
      "circle_transfer_usdc",
      "circle_wallet_create",
      "circle_wallet_list",
      "circle_x402_pay",
    ]);

    // Every tool has a JSON Schema with type: object
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("transfer tool schema includes address regex pattern", async () => {
    const msg: any = await client.request("tools/list");
    const transfer = msg.result.tools.find((t: any) => t.name === "circle_transfer_usdc");
    expect(transfer.inputSchema.properties.to_address.pattern).toBe("^0x[a-fA-F0-9]{40}$");
  });

  // ── Tool calls: validation errors ──

  it("rejects wallet_create with missing required field", async () => {
    const msg: any = await client.callTool("circle_wallet_create", {});
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("Input validation error");
  });

  it("rejects wallet_create with invalid type enum", async () => {
    const msg: any = await client.callTool("circle_wallet_create", {
      name: "test",
      type: "invalid",
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("Input validation error");
  });

  it("rejects transfer with invalid Ethereum address", async () => {
    const msg: any = await client.callTool("circle_transfer_usdc", {
      wallet_id: "wal_test",
      to_address: "0xTOOSHORT",
      amount_usdc: 1,
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("Must be a valid Ethereum address");
  });

  it("rejects transfer with zero amount", async () => {
    const msg: any = await client.callTool("circle_transfer_usdc", {
      wallet_id: "wal_test",
      to_address: "0x" + "a".repeat(40),
      amount_usdc: 0,
    });
    expect(msg.result.isError).toBe(true);
  });

  it("rejects transfer with memo starting with dash", async () => {
    const msg: any = await client.callTool("circle_transfer_usdc", {
      wallet_id: "wal_test",
      to_address: "0x" + "a".repeat(40),
      amount_usdc: 1,
      memo: "--flag-injection",
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("Memo must start with alphanumeric");
  });

  it("rejects transfer with memo exceeding 128 chars", async () => {
    const msg: any = await client.callTool("circle_transfer_usdc", {
      wallet_id: "wal_test",
      to_address: "0x" + "a".repeat(40),
      amount_usdc: 1,
      memo: "x".repeat(129),
    });
    expect(msg.result.isError).toBe(true);
  });

  it("rejects x402_pay with invalid URL", async () => {
    const msg: any = await client.callTool("circle_x402_pay", {
      wallet_id: "wal_test",
      endpoint_url: "not-a-url",
      max_price_usdc: 0.1,
    });
    expect(msg.result.isError).toBe(true);
  });

  it("rejects x402_pay with zero max price", async () => {
    const msg: any = await client.callTool("circle_x402_pay", {
      wallet_id: "wal_test",
      endpoint_url: "https://example.com/api",
      max_price_usdc: 0,
    });
    expect(msg.result.isError).toBe(true);
  });

  it("rejects policy_set with negative daily cap", async () => {
    const msg: any = await client.callTool("circle_policy_set", {
      wallet_id: "wal_test",
      daily_cap_usdc: -5,
      x402_cap_usdc: 0.1,
    });
    expect(msg.result.isError).toBe(true);
  });

  // ── Tool calls: valid input → CLI ENOENT (expected) ──
  // These prove the full pipeline works: Zod passes, handler runs,
  // CLI call is attempted. ENOENT = circle binary not installed.

  it("wallet_create with valid input reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_wallet_create", {
      name: "e2e-test-wallet",
      type: "dev",
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("wallet_list with empty args reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_wallet_list", {});
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("balance with valid wallet_id reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_balance", {
      wallet_id: "wal_e2e_test",
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("policy_set with valid input reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_policy_set", {
      wallet_id: "wal_test",
      daily_cap_usdc: 10,
      x402_cap_usdc: 0.5,
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("transfer with valid input and memo reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_transfer_usdc", {
      wallet_id: "wal_test",
      to_address: "0x" + "a".repeat(40),
      amount_usdc: 5.50,
      memo: "E2E test payment May-June",
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("x402_pay with valid GET request reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_x402_pay", {
      wallet_id: "wal_test",
      endpoint_url: "https://api.example.com/btc-signal",
      max_price_usdc: 0.10,
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  it("x402_pay with POST + body reaches CLI (ENOENT)", async () => {
    const msg: any = await client.callTool("circle_x402_pay", {
      wallet_id: "wal_test",
      endpoint_url: "https://api.example.com/query",
      max_price_usdc: 1.00,
      method: "POST",
      body: '{"query": "btc trend"}',
    });
    expect(msg.result.isError).toBe(true);
    expect(msg.result.content[0].text).toContain("ENOENT");
  });

  // ── Protocol edge cases ──

  it("handles unknown tool name gracefully", async () => {
    const msg: any = await client.callTool("nonexistent_tool", {});
    // MCP SDK should return an error for unknown tools
    expect(msg.error || msg.result?.isError).toBeTruthy();
  });
});
