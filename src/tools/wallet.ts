import { z } from "zod";
import { circleCLI } from "../circle/cli.js";

export const WalletCreateSchema = z.object({
  name: z.string().describe("Human-readable wallet name (e.g. 'eva-treasury')"),
  type: z.enum(["smart", "hosted", "dev"]).default("dev").describe(
    "Wallet type: 'dev' for testnet, 'hosted' for custodial, 'smart' for on-chain programmable"
  ),
});

export const WalletListSchema = z.object({});

export const BalanceSchema = z.object({
  wallet_id: z.string().describe("Wallet ID to check balance for"),
});

export const walletTools = [
  {
    name: "circle_wallet_create",
    description:
      "Create a new Circle agent wallet. Returns the wallet ID and on-chain address. Start with type='dev' for testnet exploration.",
    schema: WalletCreateSchema,
    handler: async (input: z.infer<typeof WalletCreateSchema>) => {
      return circleCLI(["wallet", "create", "--name", input.name, "--type", input.type, "--output", "json"]);
    },
  },
  {
    name: "circle_wallet_list",
    description: "List all Circle agent wallets and their USDC balances.",
    schema: WalletListSchema,
    handler: async (_input: z.infer<typeof WalletListSchema>) => {
      return circleCLI(["wallet", "list", "--output", "json"]);
    },
  },
  {
    name: "circle_balance",
    description: "Get USDC balance and the last 10 transactions for a specific wallet.",
    schema: BalanceSchema,
    handler: async (input: z.infer<typeof BalanceSchema>) => {
      return circleCLI(["wallet", "balance", input.wallet_id, "--output", "json"]);
    },
  },
];
