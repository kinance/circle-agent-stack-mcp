import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Thin shell wrapper around the Circle CLI.
// v0.1: shells out to `circle` binary; v0.2 will switch to direct HTTP.
export async function circleCLI(args: string[]): Promise<unknown> {
  const env = {
    ...process.env,
    CIRCLE_API_KEY: process.env.CIRCLE_API_KEY ?? "",
  };

  if (!env.CIRCLE_API_KEY) {
    throw new Error("CIRCLE_API_KEY environment variable is required");
  }

  const { stdout, stderr } = await execFileAsync("circle", args, {
    env,
    timeout: 30_000,
  });

  if (stderr) {
    // Circle CLI writes non-fatal warnings to stderr; only throw on actual errors
    const lower = stderr.toLowerCase();
    if (lower.includes("error") || lower.includes("failed")) {
      throw new Error(`circle CLI error: ${stderr.trim()}`);
    }
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return { raw: stdout.trim() };
  }
}
