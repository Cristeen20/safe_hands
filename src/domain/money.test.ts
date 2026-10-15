import { describe, expect, it } from "vitest";
import { parseAmount } from "./money";

describe("parseAmount", () => {
  it("parses whole and decimal amounts into minor units", () => {
    expect(parseAmount("49", "GBP")).toEqual({ ok: true, minor: 4900 });
    expect(parseAmount("49.5", "USD")).toEqual({ ok: true, minor: 4950 });
    expect(parseAmount("49.05", "CAD")).toEqual({ ok: true, minor: 4905 });
    expect(parseAmount(" 1,250.00 ", "INR")).toEqual({ ok: true, minor: 125000 });
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "12.", ".5"]) {
      expect(parseAmount(bad, "USD")).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("enforces each currency's minimum charge", () => {
    expect(parseAmount("0.49", "USD")).toEqual({ ok: false, error: "tooSmall" });
    expect(parseAmount("0.50", "USD")).toEqual({ ok: true, minor: 50 });
    expect(parseAmount("0.30", "GBP")).toEqual({ ok: true, minor: 30 });
    expect(parseAmount("0.99", "INR")).toEqual({ ok: false, error: "tooSmall" });
    expect(parseAmount("1", "INR")).toEqual({ ok: true, minor: 100 });
  });

  it("guards against typo-sized amounts", () => {
    expect(parseAmount("100000", "GBP")).toEqual({ ok: false, error: "tooLarge" });
  });
});
