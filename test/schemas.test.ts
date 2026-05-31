import { describe, it, expect } from "vitest";
import { WalletCreateSchema, BalanceSchema } from "../src/tools/wallet.js";
import { PolicySetSchema } from "../src/tools/policy.js";
import { TransferSchema } from "../src/tools/transfer.js";
import { X402PaySchema } from "../src/tools/x402.js";

describe("WalletCreateSchema", () => {
  it("accepts valid input", () => {
    expect(WalletCreateSchema.parse({ name: "test-wallet" })).toEqual({
      name: "test-wallet",
      type: "dev",
    });
  });

  it("accepts explicit type", () => {
    const result = WalletCreateSchema.parse({ name: "w", type: "smart" });
    expect(result.type).toBe("smart");
  });

  it("rejects missing name", () => {
    expect(() => WalletCreateSchema.parse({})).toThrow();
  });

  it("rejects invalid type", () => {
    expect(() => WalletCreateSchema.parse({ name: "w", type: "invalid" })).toThrow();
  });
});

describe("BalanceSchema", () => {
  it("requires wallet_id", () => {
    expect(() => BalanceSchema.parse({})).toThrow();
  });

  it("accepts valid wallet_id", () => {
    expect(BalanceSchema.parse({ wallet_id: "wal_123" })).toEqual({ wallet_id: "wal_123" });
  });
});

describe("PolicySetSchema", () => {
  it("accepts full input", () => {
    const input = {
      wallet_id: "wal_123",
      daily_cap_usdc: 10,
      x402_cap_usdc: 0.5,
      allowlist: ["0x1234567890abcdef1234567890abcdef12345678"],
    };
    const result = PolicySetSchema.parse(input);
    expect(result.daily_cap_usdc).toBe(10);
    expect(result.blocklist).toEqual([]);
  });

  it("rejects zero daily cap", () => {
    expect(() =>
      PolicySetSchema.parse({ wallet_id: "w", daily_cap_usdc: 0, x402_cap_usdc: 0.1 })
    ).toThrow();
  });

  it("rejects negative x402 cap", () => {
    expect(() =>
      PolicySetSchema.parse({ wallet_id: "w", daily_cap_usdc: 5, x402_cap_usdc: -1 })
    ).toThrow();
  });
});

describe("TransferSchema", () => {
  const validAddress = "0x1234567890abcdef1234567890abcdef12345678";

  it("accepts valid transfer", () => {
    const result = TransferSchema.parse({
      wallet_id: "wal_123",
      to_address: validAddress,
      amount_usdc: 5.0,
    });
    expect(result.memo).toBeUndefined();
  });

  it("rejects invalid Ethereum address — too short", () => {
    expect(() =>
      TransferSchema.parse({ wallet_id: "w", to_address: "0x123", amount_usdc: 1 })
    ).toThrow("Must be a valid Ethereum address");
  });

  it("rejects invalid Ethereum address — no 0x prefix", () => {
    expect(() =>
      TransferSchema.parse({
        wallet_id: "w",
        to_address: "1234567890abcdef1234567890abcdef12345678",
        amount_usdc: 1,
      })
    ).toThrow("Must be a valid Ethereum address");
  });

  it("rejects non-hex characters in address", () => {
    expect(() =>
      TransferSchema.parse({
        wallet_id: "w",
        to_address: "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
        amount_usdc: 1,
      })
    ).toThrow("Must be a valid Ethereum address");
  });

  it("rejects zero amount", () => {
    expect(() =>
      TransferSchema.parse({ wallet_id: "w", to_address: validAddress, amount_usdc: 0 })
    ).toThrow();
  });

  it("accepts optional memo within limit", () => {
    const result = TransferSchema.parse({
      wallet_id: "w",
      to_address: validAddress,
      amount_usdc: 1,
      memo: "payment for service",
    });
    expect(result.memo).toBe("payment for service");
  });

  it("rejects memo exceeding 128 chars", () => {
    expect(() =>
      TransferSchema.parse({
        wallet_id: "w",
        to_address: validAddress,
        amount_usdc: 1,
        memo: "x".repeat(129),
      })
    ).toThrow();
  });

  it("rejects memo starting with dash (flag injection)", () => {
    expect(() =>
      TransferSchema.parse({
        wallet_id: "w",
        to_address: validAddress,
        amount_usdc: 1,
        memo: "--malicious-flag",
      })
    ).toThrow();
  });

  it("accepts memo with internal dashes", () => {
    const result = TransferSchema.parse({
      wallet_id: "w",
      to_address: validAddress,
      amount_usdc: 1,
      memo: "May-June payment",
    });
    expect(result.memo).toBe("May-June payment");
  });
});

describe("X402PaySchema", () => {
  it("accepts valid x402 pay request", () => {
    const result = X402PaySchema.parse({
      wallet_id: "wal_123",
      endpoint_url: "https://api.example.com/data",
      max_price_usdc: 0.1,
    });
    expect(result.method).toBe("GET");
    expect(result.body).toBeUndefined();
  });

  it("rejects invalid URL", () => {
    expect(() =>
      X402PaySchema.parse({
        wallet_id: "w",
        endpoint_url: "not-a-url",
        max_price_usdc: 0.1,
      })
    ).toThrow();
  });

  it("rejects zero max price", () => {
    expect(() =>
      X402PaySchema.parse({
        wallet_id: "w",
        endpoint_url: "https://example.com",
        max_price_usdc: 0,
      })
    ).toThrow();
  });

  it("accepts POST with body", () => {
    const result = X402PaySchema.parse({
      wallet_id: "w",
      endpoint_url: "https://example.com/api",
      max_price_usdc: 0.5,
      method: "POST",
      body: '{"key": "value"}',
    });
    expect(result.method).toBe("POST");
    expect(result.body).toBe('{"key": "value"}');
  });
});
