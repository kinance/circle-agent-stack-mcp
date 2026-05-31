import { z } from "zod";
import { circleCLI } from "../circle/cli.js";

export const X402PaySchema = z.object({
  wallet_id: z.string().describe("Circle wallet ID to pay from"),
  endpoint_url: z.string().url().describe("The x402-priced HTTP endpoint URL to call"),
  max_price_usdc: z.number().positive().describe("Refuse if the endpoint quotes more than this price in USDC"),
  method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method for the paid request"),
  body: z.string().optional().describe("Request body for POST calls (JSON string)"),
});

export const x402Tools = [
  {
    name: "circle_x402_pay",
    description:
      "Pay an x402-priced HTTP endpoint using USDC from a Circle wallet, then return the response body. The server negotiates price, pays atomically, and fetches the content in one step. Use max_price_usdc as a safety cap — the call fails if the endpoint quotes higher.",
    schema: X402PaySchema,
    handler: async (input: z.infer<typeof X402PaySchema>) => {
      const args = [
        "x402", "pay",
        "--wallet", input.wallet_id,
        "--url", input.endpoint_url,
        "--max-price", String(input.max_price_usdc),
        "--method", input.method,
        "--output", "json",
      ];
      if (input.body) args.push("--body", input.body);
      return circleCLI(args);
    },
  },
];
