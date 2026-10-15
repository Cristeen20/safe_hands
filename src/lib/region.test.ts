import { describe, expect, it } from "vitest";
import { REGION_CONFIG, guessTimeZone, regionForLocale } from "./region";

describe("regionForLocale", () => {
  it("maps each site locale to its market", () => {
    expect(regionForLocale("en-US")).toBe("US");
    expect(regionForLocale("en-CA")).toBe("CA");
    expect(regionForLocale("en-GB")).toBe("GB");
    expect(regionForLocale("en-IN")).toBe("IN");
  });
});

describe("guessTimeZone", () => {
  it("uses the browser's zone when it belongs to the market", () => {
    expect(guessTimeZone("US", "America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(guessTimeZone("CA", "America/Vancouver")).toBe("America/Vancouver");
    expect(guessTimeZone("IN", "Asia/Kolkata")).toBe("Asia/Kolkata");
  });

  it("falls back to the market default otherwise", () => {
    expect(guessTimeZone("US", "America/Toronto")).toBe("America/New_York");
    expect(guessTimeZone("CA", "America/Chicago")).toBe("America/Toronto");
    expect(guessTimeZone("GB", "Asia/Kolkata")).toBe("Europe/London");
    expect(guessTimeZone("IN", "Europe/London")).toBe("Asia/Kolkata");
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
