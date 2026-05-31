import { z } from "zod";
import { circleCLI } from "../circle/cli.js";

export const TransferSchema = z.object({
  wallet_id: z.string().describe("Source wallet ID"),
  to_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address (0x + 40 hex chars)").describe("Recipient on-chain address (0x...)"),
  amount_usdc: z.number().positive().describe("Amount in USDC (e.g. 5.00 = five dollars)"),
  memo: z.string().max(128).regex(/^[a-zA-Z0-9][a-zA-Z0-9 .,!?\-_:;()#@]*$/, "Memo must start with alphanumeric and contain only basic punctuation").optional().describe("Optional transfer memo"),
});

export const transferTools = [
  {
    name: "circle_transfer_usdc",
    description:
      "Send USDC from a Circle agent wallet to an on-chain address. Confirm wallet policy allows the recipient address and the amount is within daily cap before calling.",
    schema: TransferSchema,
    handler: async (input: z.infer<typeof TransferSchema>) => {
      const args = [
        "transfer", "create",
        "--wallet", input.wallet_id,
        "--to", input.to_address,
        "--amount", String(input.amount_usdc),
        "--output", "json",
      ];
      if (input.memo) args.push("--memo", input.memo);
      return circleCLI(args);
    },
  },
];
