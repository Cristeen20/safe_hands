import { describe, expect, it } from "vitest";
import { REGION_CONFIG, regionForLocale } from "./region";

describe("regionForLocale", () => {
  it("maps each site locale to its market", () => {
    expect(regionForLocale("en-US")).toBe("US");
    expect(regionForLocale("en-CA")).toBe("CA");
    expect(regionForLocale("en-GB")).toBe("GB");
    expect(regionForLocale("en-IN")).toBe("IN");
  });
});

describe("payment provider (D21)", () => {
  it("uses Razorpay for India and Stripe everywhere else", () => {
    expect(REGION_CONFIG.IN.paymentProvider).toBe("razorpay");
    expect(REGION_CONFIG.US.paymentProvider).toBe("stripe");
    expect(REGION_CONFIG.CA.paymentProvider).toBe("stripe");
    expect(REGION_CONFIG.GB.paymentProvider).toBe("stripe");
  });
});
