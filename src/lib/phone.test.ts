import { describe, expect, it } from "vitest";
import { canReceiveSms, isSupportedPhone, toE164 } from "./phone";

describe("toE164", () => {
  it("parses UK numbers in national and international form", () => {
    expect(toE164("07400 123456", "GB")).toBe("+447400123456");
    expect(toE164("+44 7400 123456", "US")).toBe("+447400123456");
  });

  it("parses US and Canadian numbers, using the site's country for national format", () => {
    expect(toE164("(415) 555-2671", "US")).toBe("+14155552671");
    expect(toE164("(416) 555-0142", "CA")).toBe("+14165550142");
  });

  it("parses Indian numbers", () => {
    expect(toE164("98765 43210", "IN")).toBe("+919876543210");
    expect(toE164("+91 98765 43210", "GB")).toBe("+919876543210");
  });

  it("rejects invalid and out-of-market numbers", () => {
    expect(toE164("12345", "GB")).toBeNull();
    expect(toE164("+33 6 12 34 56 78", "GB")).toBeNull(); // France
  });
});

describe("isSupportedPhone", () => {
  it("accepts valid numbers from the four launch markets only", () => {
    expect(isSupportedPhone("+447400123456")).toBe(true);
    expect(isSupportedPhone("+14155552671")).toBe(true);
    expect(isSupportedPhone("+14165550142")).toBe(true);
    expect(isSupportedPhone("+919876543210")).toBe(true);
    expect(isSupportedPhone("+33612345678")).toBe(false);
  });
});

describe("canReceiveSms (D20)", () => {
  it("never allows texting Indian numbers", () => {
    expect(canReceiveSms("+919876543210")).toBe(false);
  });

  it("allows US, Canadian and UK numbers", () => {
    expect(canReceiveSms("+14155552671")).toBe(true);
    expect(canReceiveSms("+14165550142")).toBe(true);
    expect(canReceiveSms("+447400123456")).toBe(true);
  });

  it("rejects numbers outside the launch markets", () => {
    expect(canReceiveSms("+33612345678")).toBe(false);
  });
});
