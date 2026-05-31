import { z } from "zod";
import { circleCLI } from "../circle/cli.js";

export const PolicySetSchema = z.object({
  wallet_id: z.string().describe("Wallet ID to apply the policy to"),
  daily_cap_usdc: z.number().positive().describe("Maximum USDC spend per 24h rolling window"),
  x402_cap_usdc: z.number().positive().describe("Maximum USDC per single x402 micropayment"),
  allowlist: z.array(z.string()).default([]).describe("On-chain addresses this wallet may send to (empty = no restriction)"),
  blocklist: z.array(z.string()).default([]).describe("On-chain addresses this wallet may never send to"),
});

export const policyTools = [
  {
    name: "circle_policy_set",
    description:
      "Set spend controls on a Circle wallet: daily cap, per-x402-call cap, and address allow/block lists. Always set a daily_cap before enabling automated payments.",
    schema: PolicySetSchema,
    handler: async (input: z.infer<typeof PolicySetSchema>) => {
      const args = [
        "wallet", "policy", "set", input.wallet_id,
        "--daily-cap", String(input.daily_cap_usdc),
        "--x402-cap", String(input.x402_cap_usdc),
        "--output", "json",
      ];
      if (input.allowlist.length > 0) args.push("--allowlist", input.allowlist.join(","));
      if (input.blocklist.length > 0) args.push("--blocklist", input.blocklist.join(","));
      return circleCLI(args);
    },
  },
];
