import { describe, it, expect } from "vitest";
import { walletTools } from "../src/tools/wallet.js";
import { policyTools } from "../src/tools/policy.js";
import { transferTools } from "../src/tools/transfer.js";
import { x402Tools } from "../src/tools/x402.js";

const allTools = [...walletTools, ...policyTools, ...transferTools, ...x402Tools];

describe("MCP tool registration", () => {
  it("registers exactly 6 tools", () => {
    expect(allTools).toHaveLength(6);
  });

  it("has unique tool names", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  const expectedTools = [
    "circle_wallet_create",
    "circle_wallet_list",
    "circle_balance",
    "circle_policy_set",
    "circle_transfer_usdc",
    "circle_x402_pay",
  ];

  for (const name of expectedTools) {
    it(`includes tool: ${name}`, () => {
      const tool = allTools.find((t) => t.name === name);
      expect(tool).toBeDefined();
      expect(tool!.description).toBeTruthy();
      expect(tool!.schema).toBeDefined();
      expect(typeof tool!.handler).toBe("function");
    });
  }

  it("all tools have non-empty descriptions suitable for LLMs", () => {
    for (const tool of allTools) {
      expect(tool.description.length).toBeGreaterThan(20);
      // No jargon-only descriptions
      expect(tool.description).toMatch(/[a-z]/);
    }
  });

  it("all schemas produce valid JSON Schema via zodToJsonSchema", async () => {
    const { zodToJsonSchema } = await import("zod-to-json-schema");
    for (const tool of allTools) {
      const jsonSchema = zodToJsonSchema(tool.schema);
      expect(jsonSchema).toHaveProperty("type", "object");
      expect(jsonSchema).toHaveProperty("properties");
    }
  });
});

describe("tool handler arg building", () => {
  // These test the handler's argument construction by checking
  // that circleCLI is called with the right args.
  // We can't easily mock circleCLI here without restructuring,
  // but we CAN verify the handler functions exist and accept parsed input
  // without throwing synchronously.

  it("wallet create handler is async", () => {
    const tool = allTools.find((t) => t.name === "circle_wallet_create")!;
    const result = tool.handler({ name: "test", type: "dev" });
    expect(result).toBeInstanceOf(Promise);
    // Will reject because circle CLI isn't installed, but that's expected
    result.catch(() => {}); // suppress unhandled rejection
  });

  it("transfer handler is async", () => {
    const tool = allTools.find((t) => t.name === "circle_transfer_usdc")!;
    const result = tool.handler({
      wallet_id: "wal_test",
      to_address: "0x" + "a".repeat(40),
      amount_usdc: 1,
    });
    expect(result).toBeInstanceOf(Promise);
    result.catch(() => {});
  });
});
