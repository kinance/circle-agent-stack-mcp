import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";

// We need to mock execFile before importing circleCLI
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// Need to also mock promisify so it wraps our mock correctly
vi.mock("node:util", () => ({
  promisify: (fn: Function) => fn,
}));

describe("circleCLI", () => {
  const mockExecFile = vi.mocked(execFile);
  let circleCLI: (args: string[]) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.CIRCLE_API_KEY = "test-key-123";
    // Re-import after reset to get fresh module with mocks
    const mod = await import("../src/circle/cli.js");
    circleCLI = mod.circleCLI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when CIRCLE_API_KEY is not set", async () => {
    delete process.env.CIRCLE_API_KEY;
    const mod = await import("../src/circle/cli.js");
    await expect(mod.circleCLI(["wallet", "list"])).rejects.toThrow(
      "CIRCLE_API_KEY environment variable is required"
    );
  });

  it("parses JSON stdout correctly", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any) => {
      return Promise.resolve({ stdout: '{"wallet_id":"wal_123"}', stderr: "" }) as any;
    });

    const result = await circleCLI(["wallet", "list", "--output", "json"]);
    expect(result).toEqual({ wallet_id: "wal_123" });
  });

  it("returns raw wrapper for non-JSON stdout", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any) => {
      return Promise.resolve({ stdout: "Success: wallet created", stderr: "" }) as any;
    });

    const result = await circleCLI(["wallet", "create"]);
    expect(result).toEqual({ raw: "Success: wallet created" });
  });

  it("trims whitespace from raw stdout", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any) => {
      return Promise.resolve({ stdout: "  some output  \n", stderr: "" }) as any;
    });

    const result = await circleCLI(["test"]);
    expect(result).toEqual({ raw: "some output" });
  });

  it("forwards stderr on CLI failure", async () => {
    const err = new Error("Command failed: exit code 1") as Error & { stderr: string };
    err.stderr = "Error: invalid wallet ID";
    mockExecFile.mockImplementation(() => Promise.reject(err) as any);

    await expect(circleCLI(["wallet", "balance", "bad"])).rejects.toThrow(
      /stderr: Error: invalid wallet ID/
    );
  });

  it("handles rejection without stderr", async () => {
    mockExecFile.mockImplementation(() =>
      Promise.reject(new Error("spawn circle ENOENT")) as any
    );

    await expect(circleCLI(["wallet", "list"])).rejects.toThrow("spawn circle ENOENT");
  });

  it("passes correct arguments to execFile", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any) => {
      return Promise.resolve({ stdout: "{}", stderr: "" }) as any;
    });

    await circleCLI(["wallet", "create", "--name", "test"]);

    expect(mockExecFile).toHaveBeenCalledWith(
      "circle",
      ["wallet", "create", "--name", "test"],
      expect.objectContaining({ timeout: 30_000 })
    );
  });

  it("includes CIRCLE_API_KEY in env", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, opts: any) => {
      expect(opts.env.CIRCLE_API_KEY).toBe("test-key-123");
      return Promise.resolve({ stdout: "{}", stderr: "" }) as any;
    });

    await circleCLI(["test"]);
  });
});
