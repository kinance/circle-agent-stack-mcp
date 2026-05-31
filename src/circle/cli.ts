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

  try {
    const { stdout } = await execFileAsync("circle", args, {
      env,
      timeout: 30_000,
    });

    try {
      return JSON.parse(stdout);
    } catch {
      return { raw: stdout.trim() };
    }
  } catch (err: unknown) {
    // Forward stderr from the CLI for debuggability
    const execErr = err as { stderr?: string; message?: string };
    const stderr = execErr.stderr?.trim();
    const base = execErr.message ?? String(err);
    throw new Error(stderr ? `${base}\nstderr: ${stderr}` : base);
  }
}
