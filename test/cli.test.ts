import { describe, it, expect, vi } from "vitest";

// Test the circleCLI wrapper behavior without requiring the actual binary
describe("circleCLI", () => {
  it("throws when CIRCLE_API_KEY is not set", async () => {
    const originalKey = process.env.CIRCLE_API_KEY;
    delete process.env.CIRCLE_API_KEY;

    try {
      const { circleCLI } = await import("../src/circle/cli.js");
      await expect(circleCLI(["wallet", "list"])).rejects.toThrow(
        "CIRCLE_API_KEY environment variable is required"
      );
    } finally {
      if (originalKey) process.env.CIRCLE_API_KEY = originalKey;
    }
  });
});
