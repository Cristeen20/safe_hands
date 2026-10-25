import { describe, expect, it } from "vitest";
import { REGION_CONFIG, inServiceBounds, regionForLocale } from "./region";

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

describe("inServiceBounds", () => {
  it("accepts points in India and refuses points in the other markets", () => {
    expect(inServiceBounds({ lat: 9.3835, lng: 76.5741 })).toBe(true); // Thiruvalla
    expect(inServiceBounds({ lat: 34.08, lng: 74.8 })).toBe(true); // Srinagar
    expect(inServiceBounds({ lat: 51.5, lng: -0.12 })).toBe(false); // London
    expect(inServiceBounds({ lat: 43.65, lng: -79.38 })).toBe(false); // Toronto
    expect(inServiceBounds({ lat: 40.71, lng: -74.0 })).toBe(false); // New York
  });
});
